use signalsmith_stretch::Stretch;

use super::params::Smoothed;

const STRETCH_BLOCK: usize = 2048;
const STRETCH_INTERVAL: usize = 512;
const GLIDE_MS: f32 = 60.0;
const PANS: [f32; 4] = [-0.6, -0.2, 0.2, 0.6];

pub struct Voice {
	stretch: Stretch,
	shift: Smoothed,
	gain: Smoothed,
	pan_l: f32,
	pan_r: f32,
	scratch: Vec<f32>,
	sample_rate: f32,
}

impl Voice {
	pub fn new(sr: f32, index: usize) -> Self {
		let mut stretch = Stretch::new(1, STRETCH_BLOCK, STRETCH_INTERVAL);
		stretch.set_formant_factor(1.0, true);
		let pan = PANS[index.min(PANS.len() - 1)];
		let theta = (pan + 1.0) * std::f32::consts::FRAC_PI_4;
		Self {
			stretch,
			shift: Smoothed::new(0.0, GLIDE_MS, sr),
			gain: Smoothed::new(0.0, 20.0, sr),
			pan_l: theta.cos(),
			pan_r: theta.sin(),
			scratch: vec![0.0; 4096],
			sample_rate: sr,
		}
	}

	pub fn set_target(&mut self, semitones: i32, active: bool) {
		self.shift.target = semitones as f32;
		self.gain.target = if active { 1.0 } else { 0.0 };
	}

	pub fn process(
		&mut self,
		input: &[f32],
		out_l: &mut [f32],
		out_r: &mut [f32],
		formant_base_norm: f32,
	) {
		let n = input.len();
		self.shift.skip(n);
		self.stretch
			.set_transpose_factor_semitones(self.shift.current, Some(8000.0 / self.sample_rate));
		if formant_base_norm > 0.0 {
			self.stretch
				.signalsmith_stretch_set_formant_base(formant_base_norm);
		}
		if n > self.scratch.len() {
			self.scratch.resize(n, 0.0);
		}
		self.stretch.process(input, &mut self.scratch[..n]);
		for i in 0..n {
			let g = self.gain.next();
			let s = self.scratch[i] * g;
			out_l[i] += s * self.pan_l;
			out_r[i] += s * self.pan_r;
		}
	}

	pub fn latency_frames(&self) -> usize {
		self.stretch.input_latency() + self.stretch.output_latency()
	}
}
