import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { type Landmark, WRIST } from "../lib/gesture";
import {
	detectFpsAtom,
	handsAtom,
	trackerErrorAtom,
	trackerStatusAtom,
} from "../state/tracking";

const MIN_SCORE = 0.7;
const MIN_SPAN = 0.1;

function toLm(raw: { x: number; y: number; z: number }[]): Landmark[] {
	return raw.map((p) => ({ x: p.x, y: p.y, z: p.z }));
}

function realHand(lm: Landmark[], score: number): boolean {
	if (score < MIN_SCORE) {
		return false;
	}
	let minX = 1;
	let maxX = 0;
	let minY = 1;
	let maxY = 0;
	for (const p of lm) {
		if (p.x < minX) {
			minX = p.x;
		}
		if (p.x > maxX) {
			maxX = p.x;
		}
		if (p.y < minY) {
			minY = p.y;
		}
		if (p.y > maxY) {
			maxY = p.y;
		}
	}
	return maxX - minX > MIN_SPAN && maxY - minY > MIN_SPAN;
}

function assignRoles(hands: Landmark[][]): {
	chord: Landmark[] | null;
	expr: Landmark[] | null;
} {
	const scored = hands.map((lm) => {
		const w = lm[WRIST];
		const mx = w ? 1 - w.x : 0.5;
		return { lm, mx };
	});
	scored.sort((a, b) => a.mx - b.mx);
	if (scored.length >= 2) {
		return { chord: scored[0]?.lm ?? null, expr: scored[1]?.lm ?? null };
	}
	const only = scored[0];
	if (!only) {
		return { chord: null, expr: null };
	}
	if (only.mx < 0.5) {
		return { chord: only.lm, expr: null };
	}
	return { chord: null, expr: only.lm };
}

export function useHandTracking(
	videoRef: React.RefObject<HTMLVideoElement | null>,
) {
	const setHands = useSetAtom(handsAtom);
	const setStatus = useSetAtom(trackerStatusAtom);
	const setError = useSetAtom(trackerErrorAtom);
	const setFps = useSetAtom(detectFpsAtom);

	useEffect(() => {
		let cancelled = false;
		let landmarker: HandLandmarker | null = null;
		let raf = 0;
		let frames = 0;
		let lastFps = performance.now();

		async function create(delegate: "GPU" | "CPU") {
			const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
			return HandLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath: "/models/hand_landmarker.task",
					delegate,
				},
				runningMode: "VIDEO",
				numHands: 2,
				minHandDetectionConfidence: 0.75,
				minHandPresenceConfidence: 0.7,
				minTrackingConfidence: 0.6,
			});
		}

		async function init() {
			setStatus("loading");
			try {
				try {
					landmarker = await create("GPU");
				} catch {
					landmarker = await create("CPU");
				}
				if (cancelled) {
					landmarker.close();
					return;
				}
				setStatus("ready");
				loop();
			} catch (e) {
				setStatus("error");
				setError(e instanceof Error ? e.message : "Hand tracker failed");
			}
		}

		function loop() {
			const video = videoRef.current;
			const lm = landmarker;
			if (cancelled || !lm) {
				return;
			}
			if (video && video.readyState >= 2) {
				const result = lm.detectForVideo(video, performance.now());
				const hands = (result.landmarks ?? []).flatMap((raw, i) => {
					const pts = toLm(raw);
					const score = result.handedness[i]?.[0]?.score ?? 0;
					return realHand(pts, score) ? [pts] : [];
				});
				const roles = assignRoles(hands);
				setHands({ ...roles, ts: performance.now() });
				frames += 1;
				const now = performance.now();
				if (now - lastFps >= 1000) {
					setFps(frames);
					frames = 0;
					lastFps = now;
				}
			}
			const rvfc = (
				video as HTMLVideoElement & {
					requestVideoFrameCallback?: (cb: () => void) => number;
				}
			)?.requestVideoFrameCallback;
			if (video && rvfc) {
				raf = rvfc.call(video, loop);
			} else {
				raf = requestAnimationFrame(loop);
			}
		}

		void init();
		return () => {
			cancelled = true;
			const video = videoRef.current as
				| (HTMLVideoElement & {
						cancelVideoFrameCallback?: (id: number) => void;
				  })
				| null;
			video?.cancelVideoFrameCallback?.(raf);
			cancelAnimationFrame(raf);
			landmarker?.close();
		};
	}, [setError, setFps, setHands, setStatus, videoRef]);
}
