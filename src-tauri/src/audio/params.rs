use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug)]
pub enum ControlMsg {
	Harmony { pcs: u16, gain: f32 },
	Mix(MixSettings),
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct MixSettings {
	pub master: f32,
	pub dry: f32,
	pub harmony: f32,
	pub reverb_mix: f32,
	pub reverb_size: f32,
}

impl Default for MixSettings {
	fn default() -> Self {
		Self {
			master: 0.8,
			dry: 1.0,
			harmony: 0.8,
			reverb_mix: 0.15,
			reverb_size: 0.5,
		}
	}
}

#[derive(Clone, Copy, Debug)]
pub struct Smoothed {
	pub current: f32,
	pub target: f32,
	coef: f32,
}

impl Smoothed {
	pub fn new(initial: f32, time_ms: f32, sample_rate: f32) -> Self {
		let coef = 1.0 - (-1.0 / (time_ms / 1000.0 * sample_rate)).exp();
		Self {
			current: initial,
			target: initial,
			coef,
		}
	}

	pub fn next(&mut self) -> f32 {
		self.current += (self.target - self.current) * self.coef;
		self.current
	}

	pub fn skip(&mut self, n: usize) {
		let a = 1.0 - (1.0 - self.coef).powi(n as i32);
		self.current += (self.target - self.current) * a;
	}
}
