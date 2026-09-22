import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import type { Klass, LexicalNode } from "lexical";
import { DividerNode } from "./DividerNode.tsx";
import { EmbedNode } from "./EmbedNode.tsx";
import { ImageNode } from "./ImageNode.tsx";
import { ImageRowNode } from "./ImageRowNode.tsx";
import { VideoNode } from "./VideoNode.tsx";

/**
 * 등록 노드 목록. 저장된 문서에 있는 노드가 여기 없으면 로드가 통째로 실패하니,
 * 노드를 뺄 때는 기존 글을 마이그레이션할 것.
 *
 * HorizontalRuleNode 는 예전 글을 열려고만 남겨 둔다. 올라오는 순간
 * DividerNode 로 바뀐다 (registerDividerMigration).
 */
export const editorNodes: Array<Klass<LexicalNode>> = [
	HeadingNode,
	QuoteNode,
	ListNode,
	ListItemNode,
	CodeNode,
	CodeHighlightNode,
	LinkNode,
	AutoLinkNode,
	HorizontalRuleNode,
	DividerNode,
	TableNode,
	TableRowNode,
	TableCellNode,
	ImageNode,
	ImageRowNode,
	VideoNode,
	EmbedNode,
];
