import { useAtomValue } from "jotai";
import { chordName } from "../lib/chords";
import { type Landmark, VOLUME_HEIGHT_CAP, WRIST } from "../lib/gesture";
import { gestureAtom } from "../state/gesture";
import { handsAtom } from "../state/tracking";

const BONES: [number, number][] = [
	[0, 1],
	[1, 2],
	[2, 3],
	[3, 4],
	[0, 5],
	[5, 6],
	[6, 7],
	[7, 8],
	[5, 9],
	[9, 10],
	[10, 11],
	[11, 12],
	[9, 13],
	[13, 14],
	[14, 15],
	[15, 16],
	[13, 17],
	[17, 18],
	[18, 19],
	[19, 20],
	[0, 17],
];

const LM_IDS = [
	"l0",
	"l1",
	"l2",
	"l3",
	"l4",
	"l5",
	"l6",
	"l7",
	"l8",
	"l9",
	"l10",
	"l11",
	"l12",
	"l13",
	"l14",
	"l15",
	"l16",
	"l17",
	"l18",
	"l19",
	"l20",
] as const;

function mx(x: number) {
	return (1 - x) * 100;
}

function skeleton(lm: Landmark[] | null, color: string) {
	if (!lm) {
		return null;
	}
	return (
		<g stroke={color} fill={color} strokeWidth={0.35}>
			{BONES.map(([a, b]) => {
				const p = lm[a];
				const q = lm[b];
				if (!p || !q) {
					return null;
				}
				return (
					<line
						key={`${a}-${b}`}
						x1={mx(p.x)}
						y1={p.y * 100}
						x2={mx(q.x)}
						y2={q.y * 100}
					/>
				);
			})}
			{LM_IDS.map((id, idx) => {
				const p = lm[idx];
				if (!p) {
					return null;
				}
				return <circle key={id} cx={mx(p.x)} cy={p.y * 100} r={0.7} />;
			})}
		</g>
	);
}

export function HandOverlay() {
	const hands = useAtomValue(handsAtom);
	const gesture = useAtomValue(gestureAtom);
	const cw = hands.chord?.[WRIST];
	const ew = hands.expr?.[WRIST];
	if (!cw && !ew) {
		return null;
	}

	return (
		<svg
			aria-hidden="true"
			className="h-full w-full"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
		>
			<title>Hand overlay</title>
			{skeleton(hands.chord, "#22d3ee")}
			{skeleton(hands.expr, "#fbbf24")}
			{cw && ew ? (
				<text
					x={(mx(cw.x) + mx(ew.x)) / 2}
					y={((cw.y + ew.y) / 2) * 100}
					fill="#fafafa"
					stroke="#171717"
					strokeWidth={0.7}
					paintOrder="stroke"
					fontSize={8}
					fontWeight={700}
					textAnchor="middle"
					dominantBaseline="middle"
				>
					{chordName(gesture.root, gesture.quality)}
				</text>
			) : null}
			{ew ? (
				<rect
					x={98}
					y={100 - gesture.volume * VOLUME_HEIGHT_CAP * 100}
					width={2}
					height={gesture.volume * VOLUME_HEIGHT_CAP * 100}
					fill="#fbbf24"
				/>
			) : null}
		</svg>
	);
}
