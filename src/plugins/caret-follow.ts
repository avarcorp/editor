import { $isTableNode } from "@lexical/table";
import { $createParagraphNode, $getRoot, $isElementNode } from "lexical";
import { SKIP_AUTOSAVE_TAG } from "../media/media-upload.ts";

/**
 * 커서를 따라 내려갈 업데이트인가.
 *
 * 글자를 치거나 줄을 바꿔 내용이 바뀐 때만 따라간다. 본문을 눌러 포커스하거나
 * 커서만 옮긴 것은 내용이 그대로라 따라가지 않는다 — 누른 자리가 이미 보이는데
 * 화면이 움직이면 쓰려던 자리를 잃는다. 저장이 스스로 건 편집(사진 주소 교체)과
 * 플러그인이 붙으며 거는 편집(history-merge)도 사람이 친 게 아니다.
 */
export function isTypingUpdate({
	dirtyElements,
	dirtyLeaves,
	tags,
}: {
	dirtyElements: Map<string, unknown>;
	dirtyLeaves: Set<string>;
	tags: Set<string>;
}): boolean {
	if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return false;
	if (tags.has(SKIP_AUTOSAVE_TAG) || tags.has("history-merge")) return false;
	return true;
}

/**
 * 커서 아래로 margin 만큼 여유가 남도록 내릴 거리. 위로는 올리지 않는다.
 *
 * visibleBottom 은 실제로 보이는 바닥이다. 가상 키보드가 올라와 있으면 그 위,
 * 화면 아래에 도구 줄이 붙어 있으면 그 위까지다.
 */
export function followDistance(
	caret: { bottom: number },
	visibleBottom: number,
	margin: number,
): number {
	return Math.max(0, caret.bottom + margin - visibleBottom);
}

/**
 * 본문 아래 빈 곳을 눌렀을 때 커서를 글 끝에 둔다.
 *
 * 마지막 블록이 글을 이어 쓸 수 없는 것(사진 · 구분선 · 표 등)이면 그 아래에
 * 빈 문단을 만든다. 사진으로 끝난 글에서 아래를 눌렀는데 아무 일도 없으면
 * 이어 쓸 방법을 찾아야 한다.
 */
export function $placeCaretAtEnd(): void {
	const root = $getRoot();
	const last = root.getLastChild();
	if ($isElementNode(last) && !$isTableNode(last)) {
		last.selectEnd();
		return;
	}
	const paragraph = $createParagraphNode();
	root.append(paragraph);
	paragraph.select();
}
