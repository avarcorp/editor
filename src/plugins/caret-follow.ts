import { $isCodeNode } from "@lexical/code";
import {
	$createParagraphNode,
	$getRoot,
	$isElementNode,
	type ElementNode,
} from "lexical";
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
 * 이 블록 안에서 본문을 이어 쓸 수 있는가. 커서가 들어가는 블록(ElementNode)만
 * 묻는다 — 사진 · 구분선 · 영상은 들어갈 속이 없어 부르는 쪽에서 걸러진다.
 *
 * 묻는 건 커서가 들어가느냐가 아니라 거기 친 글자가 본문의 연장이 되느냐다.
 * 본문 아래를 누르는 건 "여기에 글을 쓰겠다" 는 뜻이라서다. 표는 속이 있지만
 * 칸 안은 따로 노는 문서다(isShadowRoot — 표가 아닌 커스텀 격자도 같이 걸린다).
 * 코드블록은 글자를 받지만 그건 코드지 본문이 아니다 — 친 글자마다 문법 색이
 * 입는다. 인용구 · 목록 · 제목은 모양만 다른 본문이라 그 안에서 이어 쓴다.
 *
 * 코드블록도 끝에서 Enter 를 세 번 치면 빠져나오기는 한다
 * ($exitCodeNodeOnEnter). 아래를 눌러 놓고 빈 줄을 세 번 넣어야 하는 건 이어
 * 쓰기가 아니라서 출구로 치지 않는다.
 *
 * 모르는 블록은 이어 쓸 수 있다고 본다 — 커스텀 노드는 대개 문단을 담는
 * 껍데기다. 다만 본문 아닌 것을 담는 커스텀 ElementNode(터미널 · 다이어그램
 * 같은 것)가 shadow root 도 아니면 여기서 걸러지지 않는다. 그런 노드는 표처럼
 * isShadowRoot() 를 켜 두면 된다.
 */
function $canContinueWriting(node: ElementNode): boolean {
	if (node.isShadowRoot()) return false;
	return !$isCodeNode(node);
}

/**
 * 본문 아래 빈 곳을 눌렀을 때 커서를 글 끝에 둔다.
 *
 * 마지막 블록이 본문을 이어 쓸 수 없는 것(사진 · 구분선 · 표 · 코드블록)이면 그
 * 아래에 빈 문단을 만든다. 사진으로 끝난 글에서 아래를 눌렀는데 아무 일도 없으면
 * 이어 쓸 방법을 찾아야 한다.
 */
export function $placeCaretAtEnd(): void {
	const root = $getRoot();
	const last = root.getLastChild();
	if ($isElementNode(last) && $canContinueWriting(last)) {
		last.selectEnd();
		return;
	}
	const paragraph = $createParagraphNode();
	root.append(paragraph);
	paragraph.select();
}
