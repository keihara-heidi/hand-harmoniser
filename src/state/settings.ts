import { atomWithStorage } from "jotai/utils";
import type { MixSettings } from "../lib/ipc";

const MIX_DEFAULT: MixSettings = {
	master: 0.8,
	dry: 1.0,
	harmony: 0.8,
	reverb_mix: 0.15,
	reverb_size: 0.5,
};

export const inputDeviceIdAtom = atomWithStorage<string | null>(
	"hh.inputDeviceId",
	null,
);
export const outputDeviceIdAtom = atomWithStorage<string | null>(
	"hh.outputDeviceId",
	null,
);
export const cameraDeviceIdAtom = atomWithStorage<string | null>(
	"hh.cameraDeviceId",
	null,
);
export const mixAtom = atomWithStorage<MixSettings>("hh.mix", MIX_DEFAULT);

export type PaneId = "devices" | "mix";

export const sidebarOpenAtom = atomWithStorage<boolean>("hh.sidebarOpen", true);
export const sidebarWidthAtom = atomWithStorage<number>("hh.sidebarWidth", 400);
export const panesOpenAtom = atomWithStorage<Record<PaneId, boolean>>(
	"hh.panes",
	{ devices: true, mix: true },
);
