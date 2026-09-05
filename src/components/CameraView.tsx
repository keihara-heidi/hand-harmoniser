import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { useHandTracking } from "../hooks/useHandTracking";
import {
	cameraRetryAtom,
	trackerErrorAtom,
	trackerStatusAtom,
} from "../state/tracking";
import { HandOverlay } from "./HandOverlay";

export function CameraView() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const [layer, setLayer] = useState({ w: "100%", h: "100%" });
	const status = useAtomValue(trackerStatusAtom);
	const error = useAtomValue(trackerErrorAtom);
	const setRetry = useSetAtom(cameraRetryAtom);
	useCamera(videoRef);
	useHandTracking(videoRef);

	useEffect(() => {
		const video = videoRef.current;
		const box = boxRef.current;
		if (!video || !box) {
			return;
		}
		const update = () => {
			const cw = box.clientWidth;
			const ch = box.clientHeight;
			const vw = video.videoWidth;
			const vh = video.videoHeight;
			if (!vw || !vh || !cw || !ch) {
				return;
			}
			const scale = Math.max(cw / vw, ch / vh);
			setLayer({ w: `${vw * scale}px`, h: `${vh * scale}px` });
		};
		const ro = new ResizeObserver(update);
		ro.observe(box);
		video.addEventListener("loadedmetadata", update);
		update();
		return () => {
			ro.disconnect();
			video.removeEventListener("loadedmetadata", update);
		};
	}, []);

	return (
		<div
			ref={boxRef}
			className="relative h-full w-full overflow-hidden bg-black"
		>
			<video
				ref={videoRef}
				playsInline
				muted
				autoPlay
				className="h-full w-full object-cover"
				style={{ transform: "scaleX(-1)" }}
			/>
			<div
				className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
				style={{ width: layer.w, height: layer.h }}
			>
				<HandOverlay />
			</div>
			{status === "loading" && !error && (
				<div className="absolute inset-0 flex items-center justify-center text-neutral-300">
					Loading hand model…
				</div>
			)}
			{error && (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-rose-400">
					<p>{error}</p>
					<button
						type="button"
						className="rounded bg-neutral-800 px-3 py-1 text-sm text-neutral-100"
						onClick={() => setRetry((n) => n + 1)}
					>
						Retry
					</button>
				</div>
			)}
		</div>
	);
}
