use std::sync::mpsc;
use std::time::Duration;

use block2::RcBlock;
use objc2::msg_send;
use objc2::runtime::{AnyClass, Bool};
use objc2_foundation::NSString;

#[link(name = "AVFoundation", kind = "framework")]
extern "C" {}

const VIDEO: &str = "vide";
const AUDIO: &str = "soun";
const AUTHORIZED: isize = 3;
const DENIED: isize = 2;
const RESTRICTED: isize = 1;

pub struct MediaPerms {
	pub camera: bool,
	pub microphone: bool,
}

pub fn request_all() -> MediaPerms {
	MediaPerms {
		camera: request(VIDEO),
		microphone: request(AUDIO),
	}
}

fn cls() -> &'static AnyClass {
	AnyClass::get(c"AVCaptureDevice").expect("AVCaptureDevice")
}

fn status(media: &str) -> isize {
	let media = NSString::from_str(media);
	unsafe { msg_send![cls(), authorizationStatusForMediaType: &*media] }
}

fn request(media: &str) -> bool {
	match status(media) {
		AUTHORIZED => return true,
		DENIED | RESTRICTED => return false,
		_ => {}
	}
	let (tx, rx) = mpsc::channel();
	let media_ns = NSString::from_str(media);
	let block = RcBlock::new(move |granted: Bool| {
		let _ = tx.send(granted.as_bool());
	});
	unsafe {
		let _: () = msg_send![
			cls(),
			requestAccessForMediaType: &*media_ns,
			completionHandler: &*block
		];
	}
	rx.recv_timeout(Duration::from_secs(180)).unwrap_or(false)
}
