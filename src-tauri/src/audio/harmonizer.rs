use std::sync::atomic::{AtomicI32, AtomicU32, Ordering};
use std::sync::Arc;

use super::params::{ControlMsg, MixSettings, Smoothed};
use super::pitch::PitchTracker;
use super::reverb::Reverb;
use super::voice::Voice;

pub const MAX_BLOCK: usize = 4096;

pub struct Meter {
	pub input_rms: AtomicU32,
	pub output_rms: AtomicU32,
	pub sung_midi: AtomicU32,
	pub clarity: AtomicU32,
	pub targets: [AtomicI32; 4],
}

impl Meter {
	pub fn new() -> Self {
		Self {
			input_rms: AtomicU32::new(0.0f32.to_bits()),
			output_rms: AtomicU32::new(0.0f32.to_bits()),
			sung_midi: AtomicU32::new(f32::NAN.to_bits()),
			clarity: AtomicU32::new(0.0f32.to_bits()),
			targets: std::array::from_fn(|_| AtomicI32::new(0)),
		}
	}

	pub fn store_f32(slot: &AtomicU32, v: f32) {
		slot.store(v.to_bits(), Ordering::Relaxed);
	}

	pub fn load_f32(slot: &AtomicU32) -> f32 {
		f32::from_bits(slot.load(Ordering::Relaxed))
	}

	pub fn store_i32(slot: &AtomicI32, v: i32) {
		slot.store(v, Ordering::Relaxed);
	}

	pub fn load_i32(slot: &AtomicI32) -> i32 {
		slot.load(Ordering::Relaxed)
	}
}

pub fn voice_shift(sung: i32, target: i32) -> Option<i32> {
	if target == 0 || target == sung {
		None
	} else {
		Some(target - sung)
	}
}

pub const VOICE_LO: i32 = 43; // G2: nothing lower is useful from a shifted vocal
pub const VOICE_HI: i32 = 84;
pub const MAX_SHIFT: i32 = 12; // semitones either way

/// Minimum interval allowed above `lower` (low-interval limit).
/// Below C3 only 5ths and wider; C3..G3 major 3rds and wider; above G3 anything.
fn min_gap(lower: i32) -> i32 {
	if lower < 48 {
		7
	} else if lower < 55 {
		4
	} else {
		1
	}
}

/// Four chord tones surrounding the sung note (never the sung pitch itself).
/// Adjacent voices including the lead are at least `min_gap` apart; nothing
/// below VOICE_LO or more than MAX_SHIFT from the lead. If one side runs out
/// of tones, the other fills. Unfilled slots stay 0 (muted by voice_shift).
/// `pcs` is a 12-bit mask (bit i = pitch class i). Empty mask → [0; 4].
pub fn voicing(sung: i32, pcs: u16) -> [i32; 4] {
	if pcs & 0x0FFF == 0 {
		return [0; 4];
	}
	let tone = |n: i32| pcs & (1u16 << (n.rem_euclid(12) as u32)) != 0;
	let mut below = [0i32; 4];
	let mut bn = 0usize;
	let mut prev = sung;
	for n in (VOICE_LO..sung).rev() {
		if bn == 4 {
			break;
		}
		if tone(n) && sung - n <= MAX_SHIFT && prev - n >= min_gap(n) {
			below[bn] = n;
			bn += 1;
			prev = n;
		}
	}
	let mut above = [0i32; 4];
	let mut an = 0usize;
	prev = sung;
	for n in (sung + 1)..=VOICE_HI {
		if an == 4 {
			break;
		}
		if tone(n) && n - sung <= MAX_SHIFT && n - prev >= min_gap(prev) {
			above[an] = n;
			an += 1;
			prev = n;
		}
	}
	let mut out = [0i32; 4];
	let mut k = 0usize;
	let take_b = bn.min(2);
	let take_a = an.min(2);
	out[..take_b].copy_from_slice(&below[..take_b]);
	k += take_b;
	out[k..k + take_a].copy_from_slice(&above[..take_a]);
	k += take_a;
	let mut bi = take_b;
	let mut ai = take_a;
	while k < 4 {
		if bi < bn {
			out[k] = below[bi];
			bi += 1;
			k += 1;
		} else if ai < an {
			out[k] = above[ai];
			ai += 1;
			k += 1;
		} else {
			break;
		}
	}
	out.sort_unstable();
	out
}

pub struct Harmonizer {
	voices: [Voice; 4],
	tracker: PitchTracker,
	pcs: u16,
	targets: [i32; 4],
	voiced: Option<(i32, u16)>,
	gesture_gain: Smoothed,
	master: Smoothed,
	dry: Smoothed,
	harmony: Smoothed,
	reverb_mix: Smoothed,
	reverb: Reverb,
	bus_l: Vec<f32>,
	bus_r: Vec<f32>,
	meter: Arc<Meter>,
	sr: f32,
}

impl Harmonizer {
	pub fn new(sr: f32, mix: MixSettings, meter: Arc<Meter>) -> Self {
		Self {
			voices: std::array::from_fn(|i| Voice::new(sr, i)),
			tracker: PitchTracker::new(sr),
			pcs: 0,
			targets: [0; 4],
			voiced: None,
			gesture_gain: Smoothed::new(0.0, 30.0, sr),
			master: Smoothed::new(mix.master, 30.0, sr),
			dry: Smoothed::new(mix.dry, 30.0, sr),
			harmony: Smoothed::new(mix.harmony, 30.0, sr),
			reverb_mix: Smoothed::new(mix.reverb_mix, 30.0, sr),
			reverb: {
				let mut r = Reverb::new(sr);
				r.set_room_size(mix.reverb_size);
				r
			},
			bus_l: vec![0.0; MAX_BLOCK],
			bus_r: vec![0.0; MAX_BLOCK],
			meter,
			sr,
		}
	}

	pub fn apply(&mut self, msg: ControlMsg) {
		match msg {
			ControlMsg::Harmony { pcs, gain } => {
				self.pcs = pcs;
				self.gesture_gain.target = gain.clamp(0.0, 1.0);
			}
			ControlMsg::Mix(mix) => {
				self.master.target = mix.master;
				self.dry.target = mix.dry;
				self.harmony.target = mix.harmony;
				self.reverb_mix.target = mix.reverb_mix;
				self.reverb.set_room_size(mix.reverb_size);
			}
		}
	}

	pub fn latency_ms(&self) -> f32 {
		self.voices[0].latency_frames() as f32 * 1000.0 / self.sr
	}

	pub fn process(&mut self, input_mono: &[f32], out: &mut [f32], out_channels: usize) {
		let mut offset = 0;
		while offset < input_mono.len() {
			let n = (input_mono.len() - offset).min(MAX_BLOCK);
			self.process_chunk(&input_mono[offset..offset + n], out, out_channels, offset);
			offset += n;
		}
	}

	fn process_chunk(&mut self, chunk: &[f32], out: &mut [f32], ch: usize, frame_off: usize) {
		let n = chunk.len();
		self.tracker.push(chunk);
		if let Some(sung) = self.tracker.note() {
			if self.voiced != Some((sung, self.pcs)) {
				self.targets = voicing(sung, self.pcs);
				self.voiced = Some((sung, self.pcs));
				for (i, t) in self.targets.iter().enumerate() {
					Meter::store_i32(&self.meter.targets[i], *t);
				}
			}
			for i in 0..4 {
				match voice_shift(sung, self.targets[i]) {
					Some(semis) => self.voices[i].set_target(semis, true),
					None => self.voices[i].set_target(0, false),
				}
			}
			Meter::store_f32(&self.meter.sung_midi, sung as f32);
		} else {
			Meter::store_f32(&self.meter.sung_midi, f32::NAN);
		}
		Meter::store_f32(&self.meter.clarity, self.tracker.clarity());
		let mut sq = 0.0;
		for &s in chunk {
			sq += s * s;
		}
		Meter::store_f32(&self.meter.input_rms, (sq / n.max(1) as f32).sqrt());

		self.bus_l[..n].fill(0.0);
		self.bus_r[..n].fill(0.0);
		let formant = self.tracker.hz() / self.sr;
		for v in &mut self.voices {
			v.process(chunk, &mut self.bus_l[..n], &mut self.bus_r[..n], formant);
		}
		let mut out_sq = 0.0;
		for (i, &sample) in chunk.iter().enumerate() {
			let dry = self.dry.next();
			let h = self.gesture_gain.next() * self.harmony.next();
			let mut l = sample * dry + self.bus_l[i] * h;
			let mut r = sample * dry + self.bus_r[i] * h;
			let (wl, wr) = self.reverb.tick(l, r);
			let mixv = self.reverb_mix.next();
			let m = self.master.next();
			l = (l * (1.0 - mixv) + wl * mixv) * m;
			r = (r * (1.0 - mixv) + wr * mixv) * m;
			out_sq += 0.5 * (l * l + r * r);
			let o = (frame_off + i) * ch;
			if ch == 1 {
				out[o] = 0.5 * (l + r);
			} else if ch >= 2 {
				out[o] = l;
				out[o + 1] = r;
				for c in 2..ch {
					out[o + c] = 0.0;
				}
			}
		}
		Meter::store_f32(&self.meter.output_rms, (out_sq / n.max(1) as f32).sqrt());
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn shift_rule_mutes_unison() {
		let sung = 60;
		let targets = [60, 64, 67, 71];
		let shifts: Vec<Option<i32>> = targets.iter().map(|&t| voice_shift(sung, t)).collect();
		assert_eq!(shifts, vec![None, Some(4), Some(7), Some(11)]);
	}

	const C7: u16 = 0b0100_1001_0001;

	#[test]
	fn voicing_c7_around_e() {
		assert_eq!(voicing(64, C7), [58, 60, 67, 70]);
	}

	#[test]
	fn voicing_c7_around_d() {
		assert_eq!(voicing(62, C7), [58, 60, 64, 67]);
	}

	#[test]
	fn voicing_c7_around_c_skips_unison() {
		assert_eq!(voicing(60, C7), [55, 58, 64, 67]);
	}

	#[test]
	fn voicing_c7_around_b() {
		assert_eq!(voicing(59, C7), [55, 58, 60, 64]);
	}

	#[test]
	fn voicing_empty_mask() {
		assert_eq!(voicing(60, 0), [0, 0, 0, 0]);
	}

	#[test]
	fn voicing_c7_lead_g3_spreads_low_end() {
		assert_eq!(voicing(55, C7), [48, 58, 60, 64]);
	}

	#[test]
	fn voicing_c7_lead_e3_skips_close_third() {
		assert_eq!(voicing(52, C7), [48, 58, 60, 64]);
	}

	#[test]
	fn voicing_c7_lead_c3_is_bass_and_caps_shift() {
		assert_eq!(voicing(48, C7), [0, 52, 58, 60]);
	}
}
