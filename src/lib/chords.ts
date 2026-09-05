export type Quality = "maj" | "min" | "dom7" | "min7" | "maj7" | "sus4";

export const QUALITY_INTERVALS: Record<Quality, number[]> = {
	maj: [0, 4, 7],
	min: [0, 3, 7],
	dom7: [0, 4, 7, 10],
	min7: [0, 3, 7, 10],
	maj7: [0, 4, 7, 11],
	sus4: [0, 5, 7],
};

export const QUALITY_BY_FINGERS: Quality[] = [
	"sus4",
	"maj",
	"min",
	"dom7",
	"min7",
	"maj7",
];

export const QUALITY_LABEL: Record<Quality, string> = {
	maj: "",
	min: "m",
	dom7: "7",
	min7: "m7",
	maj7: "maj7",
	sus4: "sus4",
};

export const NOTE_NAMES = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B",
];

export function chordPitchClasses(root: number, q: Quality): number[] {
	return QUALITY_INTERVALS[q].map((i) => (root + i) % 12);
}

export function chordName(root: number, q: Quality): string {
	return `${NOTE_NAMES[root % 12] ?? "C"}${QUALITY_LABEL[q]}`;
}

export function midiName(n: number): string {
	const midi = Math.round(n);
	const pc = ((midi % 12) + 12) % 12;
	const oct = Math.floor(midi / 12) - 1;
	return `${NOTE_NAMES[pc] ?? "C"}${oct}`;
}
