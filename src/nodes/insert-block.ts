import { $insertNodeToNearestRoot } from "@lexical/utils";
import {
	$getSelection,
	$isParagraphNode,
	$isRangeSelection,
	$isRootNode,
	type LexicalNode,
} from "lexical";

/**
 * 사진 · 구분선 · 표 같은 블록을 커서 자리에 넣는다.
 *
 * 빈 줄에서 넣으면 그 줄 자리에 들어가고 빈 줄은 한 칸 아래로 밀린다. 커서는
 * 그 빈 줄에 남아 곧바로 이어 쓴다. Lexical 기본 방식은 빈 줄 뒤에 넣어서,
 * [+] 로 넣을 때마다 블록 위에 빈 줄이 하나씩 남았다 — 독자 화면에도 빈 칸이
 * 그대로 나간다.
 */
export function $insertBlock(node: LexicalNode): void {
	const selection = $getSelection();
	if ($isRangeSelection(selection) && selection.isCollapsed()) {
		const line = selection.anchor.getNode();
		if (
			$isParagraphNode(line) &&
			$isRootNode(line.getParent()) &&
			line.getChildrenSize() === 0
		) {
			line.insertBefore(node);
			return;
		}
	}
	$insertNodeToNearestRoot(node);
}
