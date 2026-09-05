import { expect, test } from "bun:test";
import {
	chordRoot,
	extendedFingerCount,
	INDEX_MCP,
	INDEX_PIP,
	INDEX_TIP,
	type Landmark,
	MIDDLE_PIP,
	MIDDLE_TIP,
	PINKY_MCP,
	PINKY_PIP,
	PINKY_TIP,
	palmFacing,
	RING_PIP,
	RING_TIP,
	THUMB_IP,
	THUMB_TIP,
	volumeFromY,
	WRIST,
} from "./gesture";

function blank(): Landmark[] {
	return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

function set(lm: Landmark[], i: number, x: number, y: number) {
	lm[i] = { x, y, z: 0 };
}

test("open hand is 5 fingers", () => {
	const lm = blank();
	set(lm, WRIST, 0.5, 0.7);
	set(lm, INDEX_PIP, 0.45, 0.5);
	set(lm, INDEX_TIP, 0.45, 0.2);
	set(lm, MIDDLE_PIP, 0.5, 0.5);
	set(lm, MIDDLE_TIP, 0.5, 0.15);
	set(lm, RING_PIP, 0.55, 0.5);
	set(lm, RING_TIP, 0.55, 0.2);
	set(lm, PINKY_PIP, 0.6, 0.5);
	set(lm, PINKY_TIP, 0.6, 0.25);
	set(lm, PINKY_MCP, 0.6, 0.6);
	set(lm, THUMB_IP, 0.4, 0.6);
	set(lm, THUMB_TIP, 0.2, 0.55);
	expect(extendedFingerCount(lm)).toBe(5);
});

test("fist is 0 fingers", () => {
	const lm = blank();
	set(lm, WRIST, 0.5, 0.5);
	set(lm, INDEX_PIP, 0.5, 0.48);
	set(lm, INDEX_TIP, 0.5, 0.49);
	set(lm, MIDDLE_PIP, 0.5, 0.48);
	set(lm, MIDDLE_TIP, 0.5, 0.49);
	set(lm, RING_PIP, 0.5, 0.48);
	set(lm, RING_TIP, 0.5, 0.49);
	set(lm, PINKY_PIP, 0.5, 0.48);
	set(lm, PINKY_TIP, 0.5, 0.49);
	set(lm, PINKY_MCP, 0.51, 0.5);
	set(lm, THUMB_IP, 0.5, 0.5);
	set(lm, THUMB_TIP, 0.5, 0.5);
	expect(extendedFingerCount(lm)).toBe(0);
});

test("index only is 1 finger", () => {
	const lm = blank();
	set(lm, WRIST, 0.5, 0.7);
	set(lm, INDEX_PIP, 0.45, 0.5);
	set(lm, INDEX_TIP, 0.45, 0.2);
	set(lm, MIDDLE_PIP, 0.5, 0.65);
	set(lm, MIDDLE_TIP, 0.5, 0.66);
	set(lm, RING_PIP, 0.55, 0.65);
	set(lm, RING_TIP, 0.55, 0.66);
	set(lm, PINKY_PIP, 0.6, 0.65);
	set(lm, PINKY_TIP, 0.6, 0.66);
	set(lm, PINKY_MCP, 0.6, 0.68);
	set(lm, THUMB_IP, 0.5, 0.68);
	set(lm, THUMB_TIP, 0.5, 0.69);
	expect(extendedFingerCount(lm)).toBe(1);
});

test("palm vs back from mcp orientation", () => {
	const palm = blank();
	set(palm, WRIST, 0.5, 0.8);
	set(palm, INDEX_MCP, 0.45, 0.6);
	set(palm, PINKY_MCP, 0.55, 0.62);
	expect(palmFacing(palm, null)).toBe(true);
	const back = blank();
	set(back, WRIST, 0.5, 0.8);
	set(back, INDEX_MCP, 0.55, 0.6);
	set(back, PINKY_MCP, 0.45, 0.62);
	expect(palmFacing(back, null)).toBe(false);
});

test("palm deadband holds previous when edge-on", () => {
	const lm = blank();
	set(lm, WRIST, 0.5, 0.8);
	set(lm, INDEX_MCP, 0.5, 0.6);
	set(lm, PINKY_MCP, 0.5, 0.58);
	expect(palmFacing(lm, false)).toBe(false);
	expect(palmFacing(lm, true)).toBe(true);
});

test("chordRoot maps fingers and palm to 12 roots", () => {
	expect(chordRoot(0, true)).toBe(0); // C
	expect(chordRoot(5, true)).toBe(5); // F
	expect(chordRoot(0, false)).toBe(6); // F#
	expect(chordRoot(2, false)).toBe(8); // G#
	expect(chordRoot(7, false)).toBe(11); // clamps to B
});

test("volumeFromY is silent at the bottom and full at 60% height", () => {
	expect(volumeFromY(1)).toBe(0);
	expect(volumeFromY(0.4)).toBe(1);
	expect(volumeFromY(0)).toBe(1);
	expect(volumeFromY(0.7)).toBeCloseTo(0.5);
});
