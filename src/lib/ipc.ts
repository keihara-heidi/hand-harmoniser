import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type AudioDevices = {
	inputs: DeviceInfo[];
	outputs: DeviceInfo[];
	default_input: string | null;
	default_output: string | null;
};

export type DeviceInfo = {
	id: string;
	name: string;
};

export type AudioStatus = {
	running: boolean;
	sample_rate: number;
	buffer_frames: number;
	input_name: string;
	output_name: string;
	harmony_latency_ms: number;
};

export type MixSettings = {
	master: number;
	dry: number;
	harmony: number;
	reverb_mix: number;
	reverb_size: number;
};

export type MeterEvent = {
	input_rms: number;
	output_rms: number;
	sung_midi: number | null;
	clarity: number;
	targets: [number, number, number, number];
};

export function listAudioDevices(): Promise<AudioDevices> {
	return invoke("list_audio_devices");
}

export function startAudio(
	input_id: string | null,
	output_id: string | null,
): Promise<AudioStatus> {
	return invoke("start_audio", { inputId: input_id, outputId: output_id });
}

export function stopAudio(): Promise<void> {
	return invoke("stop_audio");
}

/** Pitch classes 0–11. Empty array mutes all voices. */
export function setHarmony(
	pcs: readonly number[],
	gain: number,
): Promise<void> {
	return invoke("set_harmony", {
		pcs: pcs.reduce((mask, pc) => mask | (1 << pc), 0),
		gain,
	});
}

export function setMix(mix: MixSettings): Promise<void> {
	return invoke("set_mix", { mix });
}

export type MediaPerms = {
	camera: boolean;
	microphone: boolean;
};

export function ensureMediaPermissions(): Promise<MediaPerms> {
	return invoke("ensure_media_permissions");
}

export function onMeter(cb: (ev: MeterEvent) => void): Promise<UnlistenFn> {
	return listen<MeterEvent>("audio://meter", (e) => {
		cb(e.payload);
	});
}
