import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { ensureMediaPermissions } from "../lib/ipc";
import { cameraDeviceIdAtom } from "../state/settings";
import {
	cameraDevicesAtom,
	cameraRetryAtom,
	trackerErrorAtom,
} from "../state/tracking";

const DENIED =
	"Camera permission denied. Enable Camera in System Settings → Privacy & Security, then Retry.";

export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
	const deviceId = useAtomValue(cameraDeviceIdAtom);
	const retry = useAtomValue(cameraRetryAtom);
	const setDevices = useSetAtom(cameraDevicesAtom);
	const setError = useSetAtom(trackerErrorAtom);

	useEffect(() => {
		let stream: MediaStream | null = null;
		let cancelled = false;
		const video = videoRef.current;

		async function start() {
			try {
				void retry;
				setError(null);
				const perms = await ensureMediaPermissions();
				if (cancelled) {
					return;
				}
				if (!perms.camera) {
					setError(DENIED);
					return;
				}
				stream = await navigator.mediaDevices.getUserMedia({
					video: {
						deviceId: deviceId ? { exact: deviceId } : undefined,
						width: 640,
						height: 480,
						frameRate: 30,
					},
					audio: false,
				});
				if (cancelled) {
					for (const t of stream.getTracks()) {
						t.stop();
					}
					return;
				}
				if (video) {
					video.srcObject = stream;
					await video.play();
				}
				const all = await navigator.mediaDevices.enumerateDevices();
				setDevices(all.filter((d) => d.kind === "videoinput"));
			} catch (e) {
				const name = e instanceof DOMException ? e.name : "";
				if (name === "NotAllowedError") {
					setError(DENIED);
				} else {
					setError(e instanceof Error ? e.message : "Camera failed");
				}
			}
		}

		void start();
		return () => {
			cancelled = true;
			if (stream) {
				for (const t of stream.getTracks()) {
					t.stop();
				}
			}
		};
	}, [deviceId, retry, setDevices, setError, videoRef]);
}
