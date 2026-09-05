import { useAtom, useAtomValue } from "jotai";
import { audioDevicesAtom } from "../state/harmony";
import {
	cameraDeviceIdAtom,
	inputDeviceIdAtom,
	outputDeviceIdAtom,
} from "../state/settings";
import { cameraDevicesAtom } from "../state/tracking";

type Kind = "input" | "output" | "camera";

export function DeviceSelect({ kind }: { kind: Kind }) {
	const audio = useAtomValue(audioDevicesAtom);
	const cameras = useAtomValue(cameraDevicesAtom);
	const [inputId, setInputId] = useAtom(inputDeviceIdAtom);
	const [outputId, setOutputId] = useAtom(outputDeviceIdAtom);
	const [cameraId, setCameraId] = useAtom(cameraDeviceIdAtom);

	const isCamera = kind === "camera";
	const id =
		kind === "input" ? inputId : kind === "output" ? outputId : cameraId;
	const setId =
		kind === "input"
			? setInputId
			: kind === "output"
				? setOutputId
				: setCameraId;

	const audioList =
		kind === "input" ? (audio?.inputs ?? []) : (audio?.outputs ?? []);
	const fallbackId =
		kind === "input" ? audio?.default_input : audio?.default_output;
	const fallbackName = audioList.find((d) => d.id === fallbackId)?.name;

	return (
		<select
			className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
			value={id ?? ""}
			onChange={(e) => {
				setId(e.target.value === "" ? null : e.target.value);
			}}
		>
			<option value="">
				{isCamera
					? "Default"
					: `Default${fallbackName ? ` (${fallbackName})` : ""}`}
			</option>
			{isCamera
				? cameras.map((d) => (
						<option key={d.deviceId} value={d.deviceId}>
							{d.label || d.deviceId}
						</option>
					))
				: audioList.map((d) => (
						<option key={d.id} value={d.id}>
							{d.name}
						</option>
					))}
		</select>
	);
}
