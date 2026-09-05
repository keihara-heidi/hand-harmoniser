import { useAtom } from "jotai";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { sidebarOpenAtom, sidebarWidthAtom } from "../state/settings";

const MIN_W = 280;

export function Sidebar({ children }: { children: ReactNode }) {
	const [open, setOpen] = useAtom(sidebarOpenAtom);
	const [width, setWidth] = useAtom(sidebarWidthAtom);
	const [dragging, setDragging] = useState(false);
	const startX = useRef(0);
	const startW = useRef(0);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
				e.preventDefault();
				setOpen((o) => !o);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [setOpen]);

	return (
		<aside
			className={`relative flex shrink-0 overflow-hidden ${dragging ? "" : "transition-[width] duration-200"}`}
			style={{ width: open ? width : 0 }}
		>
			{open && (
				<button
					type="button"
					aria-label="Resize sidebar"
					className="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize hover:bg-cyan-400/60 active:bg-cyan-400"
					onPointerDown={(e) => {
						e.currentTarget.setPointerCapture(e.pointerId);
						startX.current = e.clientX;
						startW.current = width;
						setDragging(true);
					}}
					onPointerMove={(e) => {
						if (!dragging) {
							return;
						}
						const next = startW.current + (startX.current - e.clientX);
						const max = Math.floor(window.innerWidth * 0.6);
						setWidth(Math.min(max, Math.max(MIN_W, next)));
					}}
					onPointerUp={(e) => {
						e.currentTarget.releasePointerCapture(e.pointerId);
						setDragging(false);
					}}
					onPointerCancel={(e) => {
						e.currentTarget.releasePointerCapture(e.pointerId);
						setDragging(false);
					}}
				/>
			)}
			<div className="flex flex-col gap-4 overflow-auto p-4" style={{ width }}>
				{children}
			</div>
		</aside>
	);
}
