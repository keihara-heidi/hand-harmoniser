use freeverb::Freeverb;

pub struct Reverb(Freeverb<f32>);

impl Reverb {
	pub fn new(sr: f32) -> Self {
		let mut inner = Freeverb::<f32>::new(sr as usize);
		inner.set_dry(0.0);
		inner.set_wet(1.0);
		inner.set_width(1.0);
		inner.set_room_size(0.5);
		inner.set_dampening(0.5);
		Self(inner)
	}

	pub fn tick(&mut self, l: f32, r: f32) -> (f32, f32) {
		self.0.tick((l, r))
	}

	pub fn set_room_size(&mut self, v: f32) {
		self.0.set_room_size(0.3 + v.clamp(0.0, 1.0) * 0.65);
	}
}
