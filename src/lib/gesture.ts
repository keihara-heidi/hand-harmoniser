export type Landmark = { x: number; y: number; z: number };

export const WRIST = 0;
export const THUMB_IP = 3;
export const THUMB_TIP = 4;
export const INDEX_PIP = 6;
export const INDEX_TIP = 8;
export const MIDDLE_PIP = 10;
export const MIDDLE_TIP = 12;
export const RING_PIP = 14;
export const RING_TIP = 16;
export const INDEX_MCP = 5;
export const PINKY_MCP = 17;
export const PINKY_PIP = 18;
export const PINKY_TIP = 20;

function dist(a: Landmark, b: Landmark): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.hypot(dx, dy);
}

export function extendedFingerCount(lm: Landmark[]): number {
	const wrist = lm[WRIST];
	if (!wrist) {
		return 0;
	}
	let n = 0;
	const fingers: [number, number][] = [
		[INDEX_TIP, INDEX_PIP],
		[MIDDLE_TIP, MIDDLE_PIP],
		[RING_TIP, RING_PIP],
		[PINKY_TIP, PINKY_PIP],
	];
	for (const [tip, pip] of fingers) {
		const t = lm[tip];
		const p = lm[pip];
		if (t && p && dist(t, wrist) > 1.15 * dist(p, wrist)) {
			n += 1;
		}
	}
	const thumbTip = lm[THUMB_TIP];
	const thumbIp = lm[THUMB_IP];
	const pinkyMcp = lm[PINKY_MCP];
	if (
		thumbTip &&
		thumbIp &&
		pinkyMcp &&
		dist(thumbTip, pinkyMcp) > 1.1 * dist(thumbIp, pinkyMcp)
	) {
		n += 1;
	}
	return n;
}

export const PALM_SIGN = 1;
const PALM_DEADBAND = 0.15;

/** true = palm faces camera, false = back of hand. Sign is for the user's LEFT hand
 *  in raw (unmirrored) landmark coordinates. Uses cross(indexMcp−wrist, pinkyMcp−wrist),
 *  normalised to sin(angle); rotation-invariant. Deadband keeps `prev` when the hand is
 *  nearly edge-on. */
export function palmFacing(lm: Landmark[], prev: boolean | null): boolean {
	const w = lm[WRIST];
	const i = lm[INDEX_MCP];
	const p = lm[PINKY_MCP];
	if (!w || !i || !p) {
		return prev ?? true;
	}
	const ax = i.x - w.x,
		ay = i.y - w.y;
	const bx = p.x - w.x,
		by = p.y - w.y;
	const cross = ax * by - ay * bx;
	const norm = Math.hypot(ax, ay) * Math.hypot(bx, by);
	if (norm === 0) {
		return prev ?? true;
	}
	const s = (cross / norm) * PALM_SIGN;
	if (prev !== null && Math.abs(s) < PALM_DEADBAND) {
		return prev;
	}
	return s > 0;
}

/** 0–5 fingers → C..F (palm) or F#..B (back). */
export function chordRoot(fingers: number, palm: boolean): number {
	return Math.min(5, Math.max(0, fingers)) + (palm ? 0 : 6);
}

/** Full volume at 60% of frame height from the bottom; silence at the bottom. */
export const VOLUME_HEIGHT_CAP = 0.6;

export function volumeFromY(y: number): number {
	return Math.min(1, Math.max(0, (1 - y) / VOLUME_HEIGHT_CAP));
}
