import {
	$getSelection,
	$isParagraphNode,
	$isRangeSelection,
	$isRootNode,
	type NodeKey,
} from "lexical";

/**
 * 커서가 맨 바깥의 빈 문단에 있으면 그 문단의 키. 아니면 null.
 *
 * [+] 는 "여기에 무엇을 넣을까" 를 묻는 자리라 빈 줄에서만 뜬다. 제목 · 목록 ·
 * 표 칸 안의 빈 줄은 이미 무엇을 쓸지 정한 자리라 뜨지 않는다.
 */
export function $emptyLineKey(): NodeKey | null {
	const selection = $getSelection();
	if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;

	const node = selection.anchor.getNode();
	if (!$isParagraphNode(node)) return null;
	if (!$isRootNode(node.getParent())) return null;
	if (node.getChildrenSize() > 0) return null;
	return node.getKey();
}
