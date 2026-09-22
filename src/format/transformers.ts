import {
	CHECK_LIST,
	ELEMENT_TRANSFORMERS,
	type ElementTransformer,
	MULTILINE_ELEMENT_TRANSFORMERS,
	TEXT_FORMAT_TRANSFORMERS,
	TEXT_MATCH_TRANSFORMERS,
	type TextMatchTransformer,
	type Transformer,
} from "@lexical/markdown";
import type { LexicalNode } from "lexical";
import {
	$createDividerNode,
	$isDividerNode,
	DividerNode,
} from "../nodes/DividerNode.tsx";
import {
	$createImageNode,
	$isImageNode,
	ImageNode,
} from "../nodes/ImageNode.tsx";

/** `---` 로 구분선. 모양은 마크다운에 없어서 긴 선으로 들어오고 `---` 로 나간다. */
const HR: ElementTransformer = {
	dependencies: [DividerNode],
	export: (node: LexicalNode) => ($isDividerNode(node) ? "---" : null),
	regExp: /^(---|\*\*\*|___)\s?$/,
	replace: (parentNode, _children, _match, isImport) => {
		const line = $createDividerNode("line");
		if (isImport || parentNode.getNextSibling() != null) {
			parentNode.replace(line);
		} else {
			parentNode.insertBefore(line);
		}
		line.selectNext();
	},
	type: "element",
};

/** `![대체텍스트](url)` */
const IMAGE: TextMatchTransformer = {
	dependencies: [ImageNode],
	export: (node) => {
		if (!$isImageNode(node)) return null;
		return `![${node.getTextContent()}](${node.getSrc()})`;
	},
	importRegExp: /!\[([^[]*)\]\(([^()\s]+)\)/,
	regExp: /!\[([^[]*)\]\(([^()\s]+)\)$/,
	replace: (textNode, match) => {
		const [, altText, src] = match;
		textNode.replace($createImageNode({ src, altText }));
	},
	trigger: ")",
	type: "text-match",
};

/**
 * 마크다운 단축 입력 목록.
 *
 * 한글 IME 주의: Lexical 의 마크다운 단축키는 스페이스/엔터 입력 시점에 동작한다.
 * 한글은 스페이스를 누르는 순간 조합이 끝나므로 `## 제목` 같은 입력이 그대로 먹힌다.
 * 다만 `**굵게**` 처럼 닫는 기호로 끝나는 변환은 조합 중에는 걸리지 않고,
 * 조합이 확정된 뒤(다음 글자 입력·스페이스·포커스 이동)에 적용된다 — 정상 동작이다.
 */
export const TRANSFORMERS: Array<Transformer> = [
	IMAGE,
	HR,
	CHECK_LIST,
	...ELEMENT_TRANSFORMERS,
	...MULTILINE_ELEMENT_TRANSFORMERS,
	...TEXT_FORMAT_TRANSFORMERS,
	...TEXT_MATCH_TRANSFORMERS,
];
