import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import {
	listAudioDevices,
	onMeter,
	setMix,
	startAudio,
	stopAudio,
} from "../lib/ipc";
import {
	audioDevicesAtom,
	audioErrorAtom,
	audioStatusAtom,
	inputRmsAtom,
	outputRmsAtom,
	sungMidiAtom,
	targetsAtom,
} from "../state/harmony";
import {
	inputDeviceIdAtom,
	mixAtom,
	outputDeviceIdAtom,
} from "../state/settings";

function errMsg(e: unknown): string {
	if (e instanceof Error) {
		return e.message;
	}
	if (typeof e === "string") {
		return e;
	}
	return "Audio failed";
}
let audioEpoch = 0;

export function useAudioEngine() {
	const inputId = useAtomValue(inputDeviceIdAtom);
	const outputId = useAtomValue(outputDeviceIdAtom);
	const mix = useAtomValue(mixAtom);
	const mixRef = useRef(mix);
	mixRef.current = mix;

	const setDevices = useSetAtom(audioDevicesAtom);
	const setStatus = useSetAtom(audioStatusAtom);
	const setError = useSetAtom(audioErrorAtom);
	const setSung = useSetAtom(sungMidiAtom);
	const setRms = useSetAtom(inputRmsAtom);
	const setOutRms = useSetAtom(outputRmsAtom);
	const setTargets = useSetAtom(targetsAtom);

	const fail = useCallback(
		(e: unknown) => {
			setError(errMsg(e));
			setStatus(null);
		},
		[setError, setStatus],
	);

	useEffect(() => {
		void listAudioDevices()
			.then(setDevices)
			.catch((e) => setError(errMsg(e)));
	}, [setDevices, setError]);

	useEffect(() => {
		let cancelled = false;
		let unlisten: (() => void) | null = null;
		void onMeter((ev) => {
			setSung(ev.sung_midi);
			setRms(ev.input_rms);
			setOutRms(ev.output_rms);
			const t = ev.targets;
			if (!t) {
				return;
			}
			setTargets(t.every((n) => n === 0) ? null : t);
		})
			.then((fn) => {
				if (cancelled) {
					fn();
				} else {
					unlisten = fn;
				}
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, [setOutRms, setRms, setSung, setTargets]);

	useEffect(() => {
		const epoch = ++audioEpoch;
		void (async () => {
			try {
				const status = await startAudio(inputId, outputId);
				if (epoch !== audioEpoch) {
					return;
				}
				setStatus(status);
				setError(null);
				await setMix(mixRef.current).catch(() => {});
			} catch (e) {
				if (epoch === audioEpoch) {
					fail(e);
				}
			}
		})();
		return () => {
			if (epoch === audioEpoch) {
				audioEpoch++;
				void stopAudio().catch(() => {});
			}
		};
	}, [fail, inputId, outputId, setError, setStatus]);

	useEffect(() => {
		const t = window.setTimeout(() => {
			void setMix(mix).catch(() => {});
		}, 50);
		return () => {
			clearTimeout(t);
		};
	}, [mix]);

	const restart = useCallback(async () => {
		try {
			await stopAudio().catch(() => {});
			const status = await startAudio(inputId, outputId);
			setStatus(status);
			setError(null);
			await setMix(mixRef.current).catch(() => {});
		} catch (e) {
			fail(e);
		}
	}, [fail, inputId, outputId, setError, setStatus]);

	return { restart };
}
