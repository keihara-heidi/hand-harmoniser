use std::str::FromStr;

use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct DeviceInfo {
	pub id: String,
	pub name: String,
}

#[derive(Serialize)]
pub struct AudioDevices {
	pub inputs: Vec<DeviceInfo>,
	pub outputs: Vec<DeviceInfo>,
	pub default_input: Option<String>,
	pub default_output: Option<String>,
}

fn info(device: &cpal::Device) -> DeviceInfo {
	let id = device.id().map(|id| id.to_string()).unwrap_or_default();
	let name = device
		.description()
		.map(|d| d.name().to_string())
		.unwrap_or_else(|_| device.to_string());
	DeviceInfo { id, name }
}

pub fn list() -> Result<AudioDevices, String> {
	let host = cpal::default_host();
	let inputs: Vec<DeviceInfo> = host
		.input_devices()
		.map_err(|e| e.to_string())?
		.map(|d| info(&d))
		.collect();
	let outputs: Vec<DeviceInfo> = host
		.output_devices()
		.map_err(|e| e.to_string())?
		.map(|d| info(&d))
		.collect();
	let default_input = host
		.default_input_device()
		.and_then(|d| d.id().ok())
		.map(|id| id.to_string());
	let default_output = host
		.default_output_device()
		.and_then(|d| d.id().ok())
		.map(|id| id.to_string());
	Ok(AudioDevices {
		inputs,
		outputs,
		default_input,
		default_output,
	})
}

pub fn resolve(host: &cpal::Host, id: Option<&str>, input: bool) -> Result<cpal::Device, String> {
	if let Some(id) = id {
		if let Ok(did) = cpal::DeviceId::from_str(id) {
			if let Some(dev) = host.device_by_id(&did) {
				return Ok(dev);
			}
		}
	}
	if input {
		host.default_input_device()
			.ok_or_else(|| "no input device".into())
	} else {
		host.default_output_device()
			.ok_or_else(|| "no output device".into())
	}
}
