import { useAtom } from "jotai";
import type { MixSettings } from "../lib/ipc";
import { mixAtom } from "../state/settings";

const SLIDERS: { key: keyof MixSettings; label: string }[] = [
	{ key: "master", label: "Master" },
	{ key: "dry", label: "Dry" },
	{ key: "harmony", label: "Harmony" },
	{ key: "reverb_mix", label: "Reverb mix" },
	{ key: "reverb_size", label: "Reverb size" },
];

export function MixSliders() {
	const [mix, setMix] = useAtom(mixAtom);

	return (
		<div className="flex flex-col gap-3">
			{SLIDERS.map(({ key, label }) => (
				<label key={key} className="block text-sm">
					<span className="mb-1 flex justify-between text-neutral-400">
						<span>{label}</span>
						<span className="font-mono text-neutral-300">
							{mix[key].toFixed(2)}
						</span>
					</span>
					<input
						type="range"
						min={0}
						max={1}
						step={0.01}
						value={mix[key]}
						className="w-full accent-cyan-400"
						onChange={(e) => {
							const value = Number(e.target.value);
							setMix((prev) => ({ ...prev, [key]: value }));
						}}
					/>
				</label>
			))}
		</div>
	);
}
