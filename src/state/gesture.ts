import { atom } from "jotai";
import type { Quality } from "../lib/chords";

export type GestureState = {
	root: number;
	quality: Quality;
	volume: number;
	chordHand: boolean;
	exprHand: boolean;
};

export const gestureAtom = atom<GestureState>({
	root: 0,
	quality: "maj",
	volume: 0,
	chordHand: false,
	exprHand: false,
});
