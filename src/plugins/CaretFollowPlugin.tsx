import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { followDistance, isTypingUpdate } from "./caret-follow.ts";

/** 커서 아래로 남겨 둘 여유. 줄 하나 반쯤이다. */
const MARGIN = 32;

function caretRect(root: HTMLElement): { top: number; bottom: number } | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return null;
	const range = selection.getRangeAt(0);
	if (!root.contains(range.startContainer)) return null;
	const rect = range.getBoundingClientRect();
	if (rect.height > 0) return rect;
	// 빈 줄에 놓인 커서는 크기가 0 이라 그 줄 상자로 잰다
	const node = range.startContainer;
	const element = node instanceof Element ? node : node.parentElement;
	return element?.getBoundingClientRect() ?? null;
}

/**
 * 실제로 보이는 바닥. 가상 키보드가 가린 부분과 화면 아래에 붙은 모바일 도구
 * 줄은 뺀다. Lexical 기본 동작은 window.innerHeight 만 보아서, 폰에서는 커서가
 * 도구 줄 뒤로 숨었다.
 */
function visibleBottom(): number {
	const viewport = window.visualViewport;
	let bottom = viewport
		? viewport.offsetTop + viewport.height
		: window.innerHeight;
	const bar = document.querySelector(".le-mobile-bar");
	if (bar && bar.getClientRects().length > 0) {
		bottom = Math.min(bottom, bar.getBoundingClientRect().top);
	}
	return bottom;
}

/**
 * 글을 쓰는 동안 커서를 따라 화면을 내린다.
 *
 * 내용이 바뀐 업데이트에서만 움직인다. 본문을 눌러 포커스하거나 커서만 옮긴
 * 때는 가만히 둔다.
 */
export function CaretFollowPlugin() {
	const [editor] = useLexicalComposerContext();

	useEffect(
		() =>
			editor.registerUpdateListener((payload) => {
				if (!isTypingUpdate(payload)) return;
				const root = editor.getRootElement();
				if (!root || document.activeElement !== root) return;
				const rect = caretRect(root);
				if (!rect) return;
				const distance = followDistance(rect, visibleBottom(), MARGIN);
				if (distance > 0) window.scrollBy(0, distance);
			}),
		[editor],
	);

	return null;
}
