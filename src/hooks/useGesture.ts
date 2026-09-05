import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { QUALITY_BY_FINGERS, type Quality } from "../lib/chords";
import {
	chordRoot,
	extendedFingerCount,
	palmFacing,
	volumeFromY,
	WRIST,
} from "../lib/gesture";
import { type GestureState, gestureAtom } from "../state/gesture";
import { handsAtom } from "../state/tracking";

const FINGER_FRAMES = 4;
const EXPR_GRACE_MS = 500;
const VOLUME_EPS = 0.01;

export function useGesture() {
	const hands = useAtomValue(handsAtom);
	const setGesture = useSetAtom(gestureAtom);
	const prevPalm = useRef<boolean | null>(null);
	const rootHistory = useRef<number[]>([]);
	const fingerHistory = useRef<number[]>([]);
	const lastExprSeen = useRef(performance.now());
	const volumeEma = useRef(0);
	const last = useRef<GestureState>({
		root: 0,
		quality: "maj",
		volume: 0,
		chordHand: false,
		exprHand: false,
	});

	useEffect(() => {
		const { chord, expr } = hands;
		let root = last.current.root;
		let quality: Quality = last.current.quality;
		let chordHand = false;
		let exprHand = false;
		const now = performance.now();

		if (chord) {
			chordHand = true;
			const palm = palmFacing(chord, prevPalm.current);
			prevPalm.current = palm;
			const candidate = chordRoot(extendedFingerCount(chord), palm);
			const rh = rootHistory.current;
			rh.push(candidate);
			if (rh.length > FINGER_FRAMES) {
				rh.shift();
			}
			if (rh.length === FINGER_FRAMES && rh.every((r) => r === candidate)) {
				root = candidate;
			}
		}

		if (expr) {
			exprHand = true;
			lastExprSeen.current = now;
			const count = extendedFingerCount(expr);
			const hist = fingerHistory.current;
			hist.push(count);
			if (hist.length > FINGER_FRAMES) {
				hist.shift();
			}
			if (hist.length === FINGER_FRAMES && hist.every((c) => c === count)) {
				quality = QUALITY_BY_FINGERS[count] ?? "maj";
			}
		}

		const exprWrist = expr?.[WRIST];
		if (exprWrist) {
			volumeEma.current =
				0.3 * volumeFromY(exprWrist.y) + 0.7 * volumeEma.current;
		} else if (now - lastExprSeen.current > EXPR_GRACE_MS) {
			volumeEma.current *= 0.85;
		}

		const next: GestureState = {
			root,
			quality,
			volume: volumeEma.current,
			chordHand,
			exprHand,
		};
		const prev = last.current;
		if (
			next.root !== prev.root ||
			next.quality !== prev.quality ||
			next.chordHand !== prev.chordHand ||
			next.exprHand !== prev.exprHand ||
			Math.abs(next.volume - prev.volume) > VOLUME_EPS
		) {
			last.current = next;
			setGesture(next);
		}
	}, [hands, setGesture]);
}
