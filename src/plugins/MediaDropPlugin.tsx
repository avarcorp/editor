import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { type RefObject, useEffect, useState } from "react";
import { type BlockBox, dropIndex, dropLineY } from "../media/drop-target.ts";
import {
	$insertMedia,
	type MediaLayout,
	type MediaRef,
} from "../media/library.ts";

/**
 * 앱의 미디어 보관함에서 끌어 온 것을 알아보는 이름.
 *
 * 파일이 아니라 주소 목록이다. 끌기를 시작하는 쪽(앱)이 setMediaDragData 로
 * 싣고, 본문 칸이 받는다.
 */
export const MEDIA_DRAG_TYPE = "application/x-le-media+json";

type DragPayload = { items: Array<MediaRef>; layout: MediaLayout };

/** 끌기를 시작할 때(dragstart) 앱이 부른다. */
export function setMediaDragData(
	dataTransfer: DataTransfer,
	items: Array<MediaRef>,
	layout: MediaLayout = "sequence",
): void {
	dataTransfer.setData(
		MEDIA_DRAG_TYPE,
		JSON.stringify({ items, layout } satisfies DragPayload),
	);
	dataTransfer.effectAllowed = "copy";
}

function hasMediaDrag(dataTransfer: DataTransfer | null): boolean {
	return Boolean(dataTransfer?.types.includes(MEDIA_DRAG_TYPE));
}

/**
 * 실린 목록을 꺼낸다. 다른 탭 · 다른 사이트에서도 같은 이름으로 끌어 올 수
 * 있으니 모양을 확인하고, http(s) 주소만 받는다.
 */
function readMediaDragData(
	dataTransfer: DataTransfer | null,
): DragPayload | null {
	const raw = dataTransfer?.getData(MEDIA_DRAG_TYPE);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<DragPayload>;
		const items = (Array.isArray(parsed.items) ? parsed.items : []).filter(
			(item): item is MediaRef =>
				(item?.kind === "image" || item?.kind === "video") &&
				typeof item.src === "string" &&
				/^https?:\/\//.test(item.src),
		);
		if (items.length === 0) return null;
		return { items, layout: parsed.layout === "row" ? "row" : "sequence" };
	} catch {
		return null;
	}
}

/**
 * 보관함에서 끌어 온 미디어를 받는다.
 *
 * 끄는 동안 들어갈 블록 사이에 선을 긋고, 놓으면 그 차례에 넣는다. 본문 칸 전체
 * (글 아래 빈 칸 포함)가 받는 자리다 — 빈 칸에 놓으면 글 끝에 붙는다.
 *
 * 붙잡는 단계(capture)에서 먼저 받고 전파를 끊는다. Lexical 의 기본 끌어 놓기가
 * 같은 이벤트를 받으면 커서 자리로 글자를 옮기려 든다.
 */
export function MediaDropPlugin({
	anchorRef,
}: {
	anchorRef: RefObject<HTMLDivElement | null>;
}) {
	const [editor] = useLexicalComposerContext();
	const [lineY, setLineY] = useState<number | null>(null);

	useEffect(() => {
		const shell = anchorRef.current;
		if (!shell) return;

		const boxes = (): Array<BlockBox> => {
			const top = shell.getBoundingClientRect().top;
			return editor.getEditorState().read(() => {
				const out: Array<BlockBox> = [];
				let previous = 0;
				for (const node of $getRoot().getChildren()) {
					const rect = editor
						.getElementByKey(node.getKey())
						?.getBoundingClientRect();
					// 그려지지 않은 블록이 있어도 차례가 어긋나지 않게 앞 블록 끝에 겹쳐 둔다.
					const box = rect
						? { top: rect.top - top, bottom: rect.bottom - top }
						: { top: previous, bottom: previous };
					previous = box.bottom;
					out.push(box);
				}
				return out;
			});
		};

		const track = (event: DragEvent) => {
			const list = boxes();
			const y = event.clientY - shell.getBoundingClientRect().top;
			const index = dropIndex(list, y);
			setLineY(dropLineY(list, index));
		};
		const indexAt = (event: DragEvent) =>
			dropIndex(boxes(), event.clientY - shell.getBoundingClientRect().top);

		const onDragOver = (event: DragEvent) => {
			if (!hasMediaDrag(event.dataTransfer)) return;
			event.preventDefault();
			event.stopPropagation();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
			track(event);
		};

		const onDrop = (event: DragEvent) => {
			if (!hasMediaDrag(event.dataTransfer)) return;
			event.preventDefault();
			event.stopPropagation();
			setLineY(null);
			const payload = readMediaDragData(event.dataTransfer);
			if (!payload) return;
			// 놓은 자리로 다시 잰다 — 마지막 dragover 와 놓는 순간 사이에 손이 움직였을 수 있다.
			const at = indexAt(event);
			editor.update(() => $insertMedia(payload.items, payload.layout, at));
		};

		const onDragLeave = (event: DragEvent) => {
			const next = event.relatedTarget;
			if (!(next instanceof Node) || !shell.contains(next)) setLineY(null);
		};
		const clear = () => setLineY(null);

		shell.addEventListener("dragover", onDragOver, true);
		shell.addEventListener("drop", onDrop, true);
		shell.addEventListener("dragleave", onDragLeave);
		window.addEventListener("dragend", clear);
		window.addEventListener("drop", clear);
		return () => {
			shell.removeEventListener("dragover", onDragOver, true);
			shell.removeEventListener("drop", onDrop, true);
			shell.removeEventListener("dragleave", onDragLeave);
			window.removeEventListener("dragend", clear);
			window.removeEventListener("drop", clear);
		};
	}, [editor, anchorRef]);

	return lineY === null ? null : (
		<div className="le-drop-line" style={{ top: lineY }} aria-hidden="true" />
	);
}
