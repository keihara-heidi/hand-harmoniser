import { useAtomValue } from "jotai";
import {
	chordName,
	midiName,
	QUALITY_BY_FINGERS,
	QUALITY_LABEL,
} from "../lib/chords";
import { gestureAtom } from "../state/gesture";
import { targetsAtom } from "../state/harmony";

export function ChordDisplay() {
	const gesture = useAtomValue(gestureAtom);
	const targets = useAtomValue(targetsAtom);
	const name = chordName(gesture.root, gesture.quality);
	const qualityLabel = QUALITY_LABEL[gesture.quality] || gesture.quality;
	const fingers = QUALITY_BY_FINGERS.indexOf(gesture.quality);
	const missing = !gesture.chordHand || !gesture.exprHand;

	return (
		<section className={gesture.chordHand ? "" : "opacity-40"}>
			<div className="text-6xl font-semibold tracking-tight">{name}</div>
			<p className="mt-2 text-sm text-neutral-400">
				{gesture.root < 6 ? "palm" : "back"} {gesture.root % 6}
				{" · "}
				{qualityLabel}
				{fingers >= 0 ? ` · ${fingers} finger${fingers === 1 ? "" : "s"}` : ""}
			</p>
			<div className="mt-3 flex flex-wrap gap-2">
				{targets ? (
					(["a", "b", "c", "d"] as const).map((id, i) => {
						const n = targets[i];
						if (n === undefined || n === 0) {
							return null;
						}
						return (
							<span
								key={id}
								className="rounded bg-neutral-800 px-2 py-1 font-mono text-sm text-neutral-200"
							>
								{midiName(n)}
							</span>
						);
					})
				) : (
					<span className="text-neutral-500">—</span>
				)}
			</div>
			{missing ? (
				<p className="mt-3 text-sm text-neutral-500">show both hands</p>
			) : null}
		</section>
	);
}
