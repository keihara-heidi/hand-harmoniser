mod devices;
mod harmonizer;
mod params;
mod pitch;
mod reverb;
mod voice;

pub use devices::AudioDevices;
pub use params::MixSettings;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{BufferSize, StreamConfig};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use devices::resolve;
use harmonizer::{Harmonizer, Meter, MAX_BLOCK};
use params::ControlMsg;

pub enum AudioCmd {
	Start {
		input_id: Option<String>,
		output_id: Option<String>,
		reply: Sender<Result<AudioStatus, String>>,
	},
	Stop {
		reply: Sender<()>,
	},
}

#[derive(Serialize, Clone)]
pub struct AudioStatus {
	pub running: bool,
	pub sample_rate: u32,
	pub buffer_frames: u32,
	pub input_name: String,
	pub output_name: String,
	pub harmony_latency_ms: f32,
}

#[derive(Serialize, Clone)]
pub struct MeterEvent {
	pub input_rms: f32,
	pub output_rms: f32,
	pub sung_midi: Option<f32>,
	pub clarity: f32,
	pub targets: [i32; 4],
}

struct Shared {
	ctrl_tx: Mutex<rtrb::Producer<ControlMsg>>,
	mix: Mutex<MixSettings>,
	last_harmony: Mutex<ControlMsg>,
	meter: Arc<Meter>,
	running: Arc<AtomicBool>,
}

pub struct AudioEngine {
	cmd_tx: Sender<AudioCmd>,
	shared: Arc<Shared>,
}

impl AudioEngine {
	pub fn new(app: AppHandle) -> Self {
		let (prod, _cons) = rtrb::RingBuffer::<ControlMsg>::new(256);
		let meter = Arc::new(Meter::new());
		let running = Arc::new(AtomicBool::new(false));
		let shared = Arc::new(Shared {
			ctrl_tx: Mutex::new(prod),
			mix: Mutex::new(MixSettings::default()),
			last_harmony: Mutex::new(ControlMsg::Harmony {
				pcs: 0,
				gain: 0.0,
			}),
			meter: meter.clone(),
			running: running.clone(),
		});
		let (cmd_tx, cmd_rx) = mpsc::channel();
		let shared_cmd = shared.clone();
		std::thread::Builder::new()
			.name("audio-control".into())
			.spawn(move || control_loop(cmd_rx, shared_cmd))
			.expect("audio-control thread");
		std::thread::Builder::new()
			.name("audio-meter".into())
			.spawn(move || meter_loop(app, meter, running))
			.expect("audio-meter thread");
		Self { cmd_tx, shared }
	}

	pub fn list_devices() -> Result<AudioDevices, String> {
		devices::list()
	}

	pub fn start(
		&self,
		input_id: Option<String>,
		output_id: Option<String>,
	) -> Result<AudioStatus, String> {
		let (tx, rx) = mpsc::channel();
		self.cmd_tx
			.send(AudioCmd::Start {
				input_id,
				output_id,
				reply: tx,
			})
			.map_err(|_| "audio thread unresponsive".to_string())?;
		rx.recv_timeout(Duration::from_secs(5))
			.unwrap_or_else(|_| Err("audio thread unresponsive".into()))
	}

	pub fn stop(&self) {
		let (tx, rx) = mpsc::channel();
		let _ = self.cmd_tx.send(AudioCmd::Stop { reply: tx });
		let _ = rx.recv_timeout(Duration::from_secs(5));
	}

	pub fn set_harmony(&self, pcs: u16, gain: f32) {
		let msg = ControlMsg::Harmony { pcs, gain };
		*self.shared.last_harmony.lock().expect("harmony") = msg;
		let _ = self.shared.ctrl_tx.lock().expect("ctrl").push(msg);
	}

	pub fn set_mix(&self, mix: MixSettings) {
		*self.shared.mix.lock().expect("mix") = mix;
		let _ = self
			.shared
			.ctrl_tx
			.lock()
			.expect("ctrl")
			.push(ControlMsg::Mix(mix));
	}
}

fn meter_loop(app: AppHandle, meter: Arc<Meter>, running: Arc<AtomicBool>) {
	loop {
		std::thread::sleep(Duration::from_millis(50));
		if !running.load(Ordering::Relaxed) {
			continue;
		}
		let sung = Meter::load_f32(&meter.sung_midi);
		let _ = app.emit(
			"audio://meter",
			MeterEvent {
				input_rms: Meter::load_f32(&meter.input_rms),
				output_rms: Meter::load_f32(&meter.output_rms),
				sung_midi: if sung.is_finite() { Some(sung) } else { None },
				clarity: Meter::load_f32(&meter.clarity),
				targets: std::array::from_fn(|i| Meter::load_i32(&meter.targets[i])),
			},
		);
	}
}

struct Running {
	_in: cpal::Stream,
	_out: cpal::Stream,
}

fn control_loop(cmd_rx: Receiver<AudioCmd>, shared: Arc<Shared>) {
	let mut running: Option<Running> = None;
	while let Ok(cmd) = cmd_rx.recv() {
		match cmd {
			AudioCmd::Start {
				input_id,
				output_id,
				reply,
			} => {
				running.take();
				shared.running.store(false, Ordering::Relaxed);
				let (prod, cons) = rtrb::RingBuffer::<ControlMsg>::new(256);
				*shared.ctrl_tx.lock().expect("ctrl") = prod;
				match start_streams(&shared, cons, input_id.as_deref(), output_id.as_deref()) {
					Ok((r, status)) => {
						shared.running.store(true, Ordering::Relaxed);
						let _ = running.insert(r);
						let _ = reply.send(Ok(status));
					}
					Err(e) => {
						let _ = reply.send(Err(e));
					}
				}
			}
			AudioCmd::Stop { reply } => {
				running.take();
				shared.running.store(false, Ordering::Relaxed);
				let _ = reply.send(());
			}
		}
	}
}

fn start_streams(
	shared: &Shared,
	ctrl_rx: rtrb::Consumer<ControlMsg>,
	input_id: Option<&str>,
	output_id: Option<&str>,
) -> Result<(Running, AudioStatus), String> {
	let host = cpal::default_host();
	let input = resolve(&host, input_id, true)?;
	let output = resolve(&host, output_id, false)?;
	let out_cfg = output.default_output_config().map_err(|e| e.to_string())?;
	let in_default = input.default_input_config().map_err(|e| e.to_string())?;
	let sr = out_cfg.sample_rate();
	let out_ch = out_cfg.channels();
	let in_ch = in_default.channels();
	match open_pair(
		shared,
		ctrl_rx,
		&input,
		&output,
		sr,
		in_ch,
		out_ch,
		BufferSize::Fixed(256),
	) {
		Ok(pair) => Ok(pair),
		Err(_) => {
			let (prod, cons) = rtrb::RingBuffer::<ControlMsg>::new(256);
			*shared.ctrl_tx.lock().expect("ctrl") = prod;
			open_pair(
				shared,
				cons,
				&input,
				&output,
				sr,
				in_ch,
				out_ch,
				BufferSize::Default,
			)
		}
	}
}

#[allow(clippy::too_many_arguments)]
fn open_pair(
	shared: &Shared,
	mut ctrl_rx: rtrb::Consumer<ControlMsg>,
	input: &cpal::Device,
	output: &cpal::Device,
	sr: u32,
	in_ch: u16,
	out_ch: u16,
	buffer_size: BufferSize,
) -> Result<(Running, AudioStatus), String> {
	let mix = *shared.mix.lock().expect("mix");
	let last = *shared.last_harmony.lock().expect("harmony");
	let mut harm = Harmonizer::new(sr as f32, mix, shared.meter.clone());
	harm.apply(last);
	let latency = harm.latency_ms();
	let ring_cap = (sr as usize / 2).max(2048);
	let (mut audio_tx, mut audio_rx) = rtrb::RingBuffer::<f32>::new(ring_cap);
	let in_ch_us = in_ch as usize;
	let out_ch_us = out_ch as usize;
	let cfg_in = StreamConfig {
		channels: in_ch,
		sample_rate: sr,
		buffer_size,
	};
	let cfg_out = StreamConfig {
		channels: out_ch,
		sample_rate: sr,
		buffer_size,
	};
	let in_stream = input
		.build_input_stream::<f32, _, _>(
			cfg_in,
			move |data: &[f32], _| {
				if in_ch_us <= 1 {
					let _ = audio_tx.push_partial_slice(data);
				} else {
					for frame in data.chunks(in_ch_us) {
						if let Some(&s) = frame.first() {
							let _ = audio_tx.push(s);
						}
					}
				}
			},
			|e| eprintln!("input stream error: {e}"),
			None,
		)
		.map_err(|e| {
			format!(
				"Input device does not support {sr} Hz; set both devices to the same rate ({e})"
			)
		})?;
	let mut mono = vec![0.0f32; MAX_BLOCK];
	let out_stream = output
		.build_output_stream::<f32, _, _>(
			cfg_out,
			move |data: &mut [f32], _| {
				while let Ok(m) = ctrl_rx.pop() {
					harm.apply(m);
				}
				let frames = data
					.len()
					.checked_div(out_ch_us)
					.unwrap_or(0)
					.min(MAX_BLOCK);

				let (_, rest) = audio_rx.pop_partial_slice(&mut mono[..frames]);
				rest.fill(0.0);
				harm.process(&mono[..frames], data, out_ch_us);
			},
			|e| eprintln!("output stream error: {e}"),
			None,
		)
		.map_err(|e| {
			format!(
				"Output device does not support {sr} Hz; set both devices to the same rate ({e})"
			)
		})?;
	in_stream.play().map_err(|e| e.to_string())?;
	out_stream.play().map_err(|e| e.to_string())?;
	let input_name = input
		.description()
		.map(|d| d.name().to_string())
		.unwrap_or_else(|_| input.to_string());
	let output_name = output
		.description()
		.map(|d| d.name().to_string())
		.unwrap_or_else(|_| output.to_string());
	let buffer_frames = out_stream.buffer_size().unwrap_or(256);
	Ok((
		Running {
			_in: in_stream,
			_out: out_stream,
		},
		AudioStatus {
			running: true,
			sample_rate: sr,
			buffer_frames,
			input_name,
			output_name,
			harmony_latency_ms: latency,
		},
	))
}
