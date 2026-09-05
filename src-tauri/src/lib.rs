mod audio;
#[cfg(target_os = "macos")]
mod macos_perm;

use audio::{AudioEngine, MixSettings};
use serde::Serialize;
use tauri::{Manager, State};

#[derive(Serialize)]
struct MediaPerms {
	camera: bool,
	microphone: bool,
}

#[tauri::command]
fn list_audio_devices() -> Result<audio::AudioDevices, String> {
	AudioEngine::list_devices()
}

#[tauri::command]
fn start_audio(
	engine: State<'_, AudioEngine>,
	input_id: Option<String>,
	output_id: Option<String>,
) -> Result<audio::AudioStatus, String> {
	engine.start(input_id, output_id)
}

#[tauri::command]
fn stop_audio(engine: State<'_, AudioEngine>) {
	engine.stop();
}

#[tauri::command]
fn set_harmony(engine: State<'_, AudioEngine>, pcs: u16, gain: f32) {
	engine.set_harmony(pcs, gain);
}

#[tauri::command]
fn set_mix(engine: State<'_, AudioEngine>, mix: MixSettings) {
	engine.set_mix(mix);
}

#[tauri::command]
async fn ensure_media_permissions() -> MediaPerms {
	#[cfg(target_os = "macos")]
	{
		tauri::async_runtime::spawn_blocking(macos_perm::request_all)
			.await
			.map(|p| MediaPerms {
				camera: p.camera,
				microphone: p.microphone,
			})
			.unwrap_or(MediaPerms {
				camera: false,
				microphone: false,
			})
	}
	#[cfg(not(target_os = "macos"))]
	{
		MediaPerms {
			camera: true,
			microphone: true,
		}
	}
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	tauri::Builder::default()
		.setup(|app| {
			app.manage(AudioEngine::new(app.handle().clone()));
			Ok(())
		})
		.invoke_handler(tauri::generate_handler![
			list_audio_devices,
			start_audio,
			stop_audio,
			set_harmony,
			set_mix,
			ensure_media_permissions
		])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
