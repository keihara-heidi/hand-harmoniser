import { useAtom, useAtomValue } from "jotai";
import { gestureAtom } from "../state/gesture";
import { audioErrorAtom, audioStatusAtom } from "../state/harmony";
import { sidebarOpenAtom } from "../state/settings";
import {
	detectFpsAtom,
	trackerErrorAtom,
	trackerStatusAtom,
} from "../state/tracking";

export function StatusBar() {
	const tracker = useAtomValue(trackerStatusAtom);
	const trackerError = useAtomValue(trackerErrorAtom);
	const fps = useAtomValue(detectFpsAtom);
	const audio = useAtomValue(audioStatusAtom);
	const audioError = useAtomValue(audioErrorAtom);
	const { chordHand, exprHand } = useAtomValue(gestureAtom);
	const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);

	const left =
		tracker === "error" && trackerError
			? `${tracker} · ${trackerError}`
			: `${tracker} · ${fps} fps`;

	let center = "audio off";
	if (audioError) {
		center = audioError;
	} else if (audio) {
		center = `${audio.sample_rate} Hz · ${audio.buffer_frames} · ${audio.input_name} → ${audio.output_name}`;
	}

	return (
		<footer className="flex items-center justify-between gap-4 border-t border-neutral-800 px-4 py-2 text-xs text-neutral-400">
			<span className="min-w-0 truncate">{left}</span>
			<span
				className={`min-w-0 truncate text-center ${audioError ? "text-red-400" : ""}`}
			>
				{center}
			</span>
			<span className="flex shrink-0 items-center gap-2">
				<button
					type="button"
					title="Toggle sidebar (⌘B)"
					aria-pressed={sidebarOpen}
					className="rounded px-1 text-neutral-400 hover:text-neutral-100"
					onClick={() => setSidebarOpen((o) => !o)}
				>
					▤
				</button>
				<span
					className={`inline-block h-2 w-2 rounded-full ${chordHand ? "bg-cyan-400" : "bg-neutral-700"}`}
					title="chord hand"
				/>
				<span
					className={`inline-block h-2 w-2 rounded-full ${exprHand ? "bg-amber-400" : "bg-neutral-700"}`}
					title="expr hand"
				/>
			</span>
		</footer>
	);
}
