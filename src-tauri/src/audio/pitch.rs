use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector;

const WINDOW: usize = 4096;
const HOP: usize = 512;
const POWER_THRESHOLD: f32 = 0.05;
const CLARITY_THRESHOLD: f32 = 0.7;
const MIN_HZ: f32 = 60.0;
const MAX_HZ: f32 = 1200.0;

pub struct PitchTracker {
	window: Vec<f32>,
	write: usize,
	filled: usize,
	since_hop: usize,
	detector: McLeodDetector<f32>,
	scratch: Vec<f32>,
	sample_rate: f32,
	note: Option<i32>,
	candidate: Option<i32>,
	candidate_hits: u8,
	last_hz: f32,
	last_clarity: f32,
}

// SAFETY: detector buffers are ordinary Vecs/RefCells used only on the audio thread.
unsafe impl Send for PitchTracker {}

impl PitchTracker {
	pub fn new(sample_rate: f32) -> Self {
		Self {
			window: vec![0.0; WINDOW],
			write: 0,
			filled: 0,
			since_hop: 0,
			detector: McLeodDetector::new(WINDOW, WINDOW / 2),
			scratch: vec![0.0; WINDOW],
			sample_rate,
			note: None,
			candidate: None,
			candidate_hits: 0,
			last_hz: 0.0,
			last_clarity: 0.0,
		}
	}

	pub fn push(&mut self, mono: &[f32]) {
		for &s in mono {
			self.window[self.write] = s;
			self.write = (self.write + 1) % WINDOW;
			if self.filled < WINDOW {
				self.filled += 1;
			}
			self.since_hop += 1;
			if self.filled == WINDOW && self.since_hop >= HOP {
				self.since_hop = 0;
				self.detect();
			}
		}
	}

	fn detect(&mut self) {
		for i in 0..WINDOW {
			self.scratch[i] = self.window[(self.write + i) % WINDOW];
		}
		let pitch = self.detector.get_pitch(
			&self.scratch,
			self.sample_rate as usize,
			POWER_THRESHOLD,
			CLARITY_THRESHOLD,
		);
		let Some(p) = pitch else {
			self.candidate = None;
			self.candidate_hits = 0;
			return;
		};
		if !(MIN_HZ..=MAX_HZ).contains(&p.frequency) {
			self.candidate = None;
			self.candidate_hits = 0;
			return;
		}
		self.last_hz = p.frequency;
		self.last_clarity = p.clarity;
		let midi = 69.0 + 12.0 * (p.frequency / 440.0).log2();
		match self.note {
			None => {
				self.note = Some(midi.round() as i32);
				self.candidate = None;
				self.candidate_hits = 0;
			}
			Some(n) if (midi - n as f32).abs() > 0.6 => {
				let c = midi.round() as i32;
				if self.candidate == Some(c) {
					self.candidate_hits += 1;
					if self.candidate_hits >= 2 {
						self.note = Some(c);
						self.candidate = None;
						self.candidate_hits = 0;
					}
				} else {
					self.candidate = Some(c);
					self.candidate_hits = 1;
				}
			}
			Some(_) => {
				self.candidate = None;
				self.candidate_hits = 0;
			}
		}
	}

	pub fn note(&self) -> Option<i32> {
		self.note
	}

	pub fn hz(&self) -> f32 {
		self.last_hz
	}

	pub fn clarity(&self) -> f32 {
		self.last_clarity
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn sine(hz: f32, sr: f32, n: usize) -> Vec<f32> {
		(0..n)
			.map(|i| (2.0 * std::f32::consts::PI * hz * i as f32 / sr).sin())
			.collect()
	}

	#[test]
	fn detects_a3() {
		let sr = 48_000.0;
		let mut t = PitchTracker::new(sr);
		t.push(&sine(220.0, sr, WINDOW * 2));
		assert_eq!(t.note(), Some(57));
	}

	#[test]
	fn hysteresis_needs_two_confirmations() {
		let sr = 48_000.0;
		let mut t = PitchTracker::new(sr);
		t.push(&sine(220.0, sr, 8192));
		assert_eq!(t.note(), Some(57));
		// One hop of A#3 is not enough to leave A3 (window still mostly 220 Hz).
		t.push(&sine(233.08, sr, HOP));
		assert_eq!(t.note(), Some(57));
		// Fill the analysis window so McLeod can confirm A#3 twice.
		t.push(&sine(233.08, sr, WINDOW * 2));
		assert_eq!(t.note(), Some(58));
	}

	#[test]
	fn detects_notes_below_cs3() {
		let sr = 48_000.0;
		for (hz, midi) in [
			(130.81, 48), // C3
			(110.0, 45),  // A2
			(98.0, 43),   // G2
			(82.41, 40),  // E2
			(65.41, 36),  // C2
		] {
			let mut t = PitchTracker::new(sr);
			t.push(&sine(hz, sr, WINDOW * 4));
			assert_eq!(t.note(), Some(midi), "sine {hz} Hz");
		}
	}
}
