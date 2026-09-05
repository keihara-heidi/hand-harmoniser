import { useAtomValue } from "jotai";
import { midiName } from "../lib/chords";
import { inputRmsAtom, outputRmsAtom, sungMidiAtom } from "../state/harmony";

function rmsToPct(rms: number): number {
	if (rms <= 0) {
		return 0;
	}
	const db = 20 * Math.log10(rms);
	return Math.min(100, Math.max(0, ((db + 60) / 60) * 100));
}

function Bar({
	label,
	rms,
	right,
	color,
}: {
	label: string;
	rms: number;
	right: string;
	color: string;
}) {
	return (
		<div>
			<div className="mb-1 flex items-baseline justify-between text-sm">
				<span className="text-neutral-400">{label}</span>
				<span className="font-mono text-neutral-200">{right}</span>
			</div>
			<div className="h-3 overflow-hidden rounded bg-neutral-800">
				<div
					className={`h-full ${color}`}
					style={{ width: `${rmsToPct(rms)}%` }}
				/>
			</div>
		</div>
	);
}

export function Meter() {
	const inRms = useAtomValue(inputRmsAtom);
	const outRms = useAtomValue(outputRmsAtom);
	const sung = useAtomValue(sungMidiAtom);
	const outDb = outRms > 0 ? `${(20 * Math.log10(outRms)).toFixed(0)} dB` : "—";

	return (
		<section className="flex flex-col gap-2">
			<Bar
				label="input"
				rms={inRms}
				right={sung === null ? "—" : midiName(sung)}
				color="bg-cyan-400"
			/>
			<Bar label="output" rms={outRms} right={outDb} color="bg-amber-400" />
		</section>
	);
}
