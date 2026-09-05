import { atom } from "jotai";
import type { AudioDevices, AudioStatus } from "../lib/ipc";

export const targetsAtom = atom<[number, number, number, number] | null>(null);
export const sungMidiAtom = atom<number | null>(null);
export const inputRmsAtom = atom(0);
export const outputRmsAtom = atom(0);
export const audioStatusAtom = atom<AudioStatus | null>(null);
export const audioErrorAtom = atom<string | null>(null);
export const audioDevicesAtom = atom<AudioDevices | null>(null);
