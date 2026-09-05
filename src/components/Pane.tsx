import { useAtom } from "jotai";
import type { ReactNode } from "react";
import { type PaneId, panesOpenAtom } from "../state/settings";

export function Pane({
	id,
	title,
	children,
}: {
	id: PaneId;
	title: string;
	children: ReactNode;
}) {
	const [panes, setPanes] = useAtom(panesOpenAtom);
	const open = panes[id];

	return (
		<section className="border-t border-neutral-800 pt-1">
			<button
				type="button"
				aria-expanded={open}
				className="flex w-full items-center gap-1 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-300 hover:text-neutral-100"
				onClick={() => setPanes((p) => ({ ...p, [id]: !p[id] }))}
			>
				<span
					className={`inline-block transition-transform duration-150 ${open ? "rotate-90" : ""}`}
				>
					▸
				</span>
				{title}
			</button>
			<div
				className="grid transition-[grid-template-rows] duration-150"
				style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
			>
				<div className="min-h-0 overflow-hidden">
					<div className="pt-2">{children}</div>
				</div>
			</div>
		</section>
	);
}
