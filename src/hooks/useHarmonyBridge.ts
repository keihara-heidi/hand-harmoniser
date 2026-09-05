import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { chordPitchClasses } from "../lib/chords";
import { setHarmony } from "../lib/ipc";
import { gestureAtom } from "../state/gesture";

const THROTTLE_MS = 34;

export function useHarmonyBridge() {
	const gesture = useAtomValue(gestureAtom);
	const timer = useRef(0);
	const pending = useRef<{
		pcs: readonly number[];
		volume: number;
	} | null>(null);

	useEffect(() => {
		void setHarmony([], 0).catch(() => {});
		return () => {
			void setHarmony([], 0).catch(() => {});
		};
	}, []);

	useEffect(() => {
		pending.current = {
			pcs: chordPitchClasses(gesture.root, gesture.quality),
			volume: gesture.volume,
		};
		if (timer.current) {
			return;
		}
		timer.current = window.setTimeout(() => {
			timer.current = 0;
			const p = pending.current;
			pending.current = null;
			if (p) {
				void setHarmony(p.pcs, p.volume).catch(() => {});
			}
		}, THROTTLE_MS);
	}, [gesture]);

	useEffect(() => {
		return () => {
			if (timer.current) {
				clearTimeout(timer.current);
				timer.current = 0;
			}
		};
	}, []);
}
