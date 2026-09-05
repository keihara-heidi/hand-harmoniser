import { atom } from "jotai";
import type { Landmark } from "../lib/gesture";

export type HandFrame = {
	chord: Landmark[] | null;
	expr: Landmark[] | null;
	ts: number;
};

export const handsAtom = atom<HandFrame>({ chord: null, expr: null, ts: 0 });
export const trackerStatusAtom = atom<"loading" | "ready" | "error">("loading");
export const trackerErrorAtom = atom<string | null>(null);
export const cameraDevicesAtom = atom<MediaDeviceInfo[]>([]);
export const detectFpsAtom = atom(0);
export const cameraRetryAtom = atom(0);
