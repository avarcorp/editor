import {
	type ReactNode,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../cx.ts";

export type Placement = "bottom-start" | "bottom-center" | "right-start";

type Point = { top: number; left: number };

const GAP = 6;
const MARGIN = 8;

function place(anchor: DOMRect, panel: DOMRect, placement: Placement): Point {
	let top: number;
	let left: number;
	if (placement === "right-start") {
		top = anchor.top;
		left = anchor.right + GAP;
		// 오른쪽에 자리가 없으면 왼쪽으로
		if (left + panel.width > window.innerWidth - MARGIN) {
			left = anchor.left - panel.width - GAP;
		}
	} else {
		top = anchor.bottom + GAP;
		left =
			placement === "bottom-center"
				? anchor.left + anchor.width / 2 - panel.width / 2
				: anchor.left;
		// 아래에 자리가 없으면 위로
		if (top + panel.height > window.innerHeight - MARGIN) {
			top = Math.max(MARGIN, anchor.top - panel.height - GAP);
		}
	}
	left = Math.min(
		Math.max(MARGIN, left),
		window.innerWidth - panel.width - MARGIN,
	);
	top = Math.min(
		Math.max(MARGIN, top),
		window.innerHeight - panel.height - MARGIN,
	);
	return { top, left };
}

/**
 * 단추에 붙어 뜨는 작은 판. 바깥을 누르거나 Esc 를 누르면 닫힌다.
 *
 * body 에 붙인다 — 도구 줄은 sticky 에 overflow 가 걸려 있어서 그 안에 두면
 * 판이 잘린다.
 */
export function Popover({
	anchor,
	anchorRect,
	open,
	onClose,
	placement = "bottom-start",
	className,
	children,
	label,
}: {
	anchor?: RefObject<HTMLElement | null>;
	/** 요소가 아닌 자리(커서 등)에 붙일 때 */
	anchorRect?: DOMRect | null;
	open: boolean;
	onClose: () => void;
	placement?: Placement;
	className?: string;
	children: ReactNode;
	label?: string;
}) {
	const panelRef = useRef<HTMLDivElement>(null);
	const [point, setPoint] = useState<Point | null>(null);

	useLayoutEffect(() => {
		if (!open) {
			setPoint(null);
			return;
		}
		const update = () => {
			const panel = panelRef.current;
			const rect = anchor?.current?.getBoundingClientRect() ?? anchorRect;
			if (!panel || !rect) return;
			setPoint(place(rect, panel.getBoundingClientRect(), placement));
		};
		update();
		window.addEventListener("resize", update);
		window.addEventListener("scroll", update, true);
		return () => {
			window.removeEventListener("resize", update);
			window.removeEventListener("scroll", update, true);
		};
	}, [open, anchor, anchorRect, placement]);

	useEffect(() => {
		if (!open) return;
		const onPointer = (event: PointerEvent) => {
			const target = event.target as Node;
			if (panelRef.current?.contains(target)) return;
			if (anchor?.current?.contains(target)) return;
			/*
			 * 다른 판 안을 누른 것도 바깥으로 치지 않는다. [+] 메뉴 옆에 구분선 모양
			 * 판이 붙는데, 그걸 누르는 순간 [+] 메뉴가 닫히면 모양 판도 같이 사라져
			 * 누른 게 먹지 않는다.
			 */
			if (target instanceof Element && target.closest(".le-popover")) return;
			onClose();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("pointerdown", onPointer, true);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("pointerdown", onPointer, true);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [open, onClose, anchor]);

	if (!open || typeof document === "undefined") return null;

	return createPortal(
		<div
			ref={panelRef}
			role="dialog"
			aria-label={label}
			className={cx("le-popover", className)}
			style={{
				top: point?.top ?? -9999,
				left: point?.left ?? -9999,
				visibility: point ? "visible" : "hidden",
			}}
		>
			{children}
		</div>,
		document.body,
	);
}
