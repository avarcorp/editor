import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { $createLinkNode, $isLinkNode, $toggleLink } from "@lexical/link";
import {
	$isListNode,
	INSERT_CHECK_LIST_COMMAND,
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
	ListNode,
	REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $createTableNodeWithDimensions } from "@lexical/table";
import { $findMatchingParent, $getNearestNodeOfType } from "@lexical/utils";
import {
	$createParagraphNode,
	$createTextNode,
	$getSelection,
	$isRangeSelection,
	$setSelection,
	type BaseSelection,
	type ElementNode,
	type LexicalEditor,
} from "lexical";
import { PLAIN_LANGUAGE } from "./code-languages.ts";
import type { EditorEnv } from "./context.tsx";
import { parseEmbed } from "./media/embed.ts";
import {
	type DividerVariant,
	INSERT_DIVIDER_COMMAND,
} from "./nodes/DividerNode.tsx";
import { $insertBlock } from "./nodes/insert-block.ts";
import {
	INSERT_EMBED_COMMAND,
	INSERT_IMAGE_FILE_COMMAND,
	INSERT_IMAGE_ROW_COMMAND,
	INSERT_VIDEO_FILE_COMMAND,
} from "./plugins/MediaPlugin.tsx";

/** 문단 모양. 본문▾ 고르개와 / 메뉴가 쓴다. */
export type BlockId =
	| "paragraph"
	| "h1"
	| "h2"
	| "h3"
	| "quote"
	| "bulletList"
	| "numberList"
	| "checkList"
	| "code";

/** 넣기 줄에 있는 것. */
export type InsertId =
	| "image"
	| "imageRow"
	| "video"
	| "embed"
	| "quote"
	| "divider"
	| "code"
	| "table"
	| "link";

/** 지금 커서가 있는 문단의 모양. */
export function $currentBlock(): BlockId | null {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return null;
	const anchor = selection.anchor.getNode();
	const top = anchor.getKey() === "root" ? null : anchor.getTopLevelElement();
	if (!top) return "paragraph";

	if ($isListNode(top)) {
		const list = $getNearestNodeOfType(anchor, ListNode) ?? top;
		const type = list.getListType();
		return type === "bullet"
			? "bulletList"
			: type === "check"
				? "checkList"
				: "numberList";
	}
	const type = top.getType();
	if (type === "heading") {
		const tag = (top as unknown as { getTag(): string }).getTag();
		return tag === "h1" || tag === "h2" || tag === "h3" ? tag : "paragraph";
	}
	if (type === "quote") return "quote";
	if (type === "code") return "code";
	return "paragraph";
}

/**
 * 문단 모양을 바꾼다. 같은 모양을 한 번 더 고르면 본문으로 돌아간다 —
 * 목록 단추를 다시 누르면 목록이 풀리는 것처럼.
 */
export function setBlock(editor: LexicalEditor, next: BlockId): void {
	editor.update(() => $setBlock(editor, next));
}

/** setBlock 의 속. 이미 열린 편집 안에서 부른다 (모바일 판이 커서를 되살린 뒤). */
export function $setBlock(editor: LexicalEditor, next: BlockId): void {
	const current = $currentBlock();
	const target: BlockId =
		current === next && next !== "paragraph" ? "paragraph" : next;
	const selection = $getSelection();
	const wrap = (create: () => ElementNode) => {
		if ($isRangeSelection(selection)) $setBlocksType(selection, create);
	};
	const isList = (id: BlockId | null) =>
		id === "bulletList" || id === "numberList" || id === "checkList";

	switch (target) {
		case "paragraph":
			if (isList(current))
				editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
			else wrap($createParagraphNode);
			break;
		case "h1":
		case "h2":
		case "h3":
			wrap(() => $createHeadingNode(target));
			break;
		case "quote":
			wrap($createQuoteNode);
			break;
		case "code":
			wrap(() => $createCodeNode());
			break;
		case "bulletList":
			editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
			break;
		case "numberList":
			editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
			break;
		case "checkList":
			editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
			break;
	}
}

/** 파일 고르기 창을 연다. 사람이 고르지 않고 닫으면 아무 일도 없다. */
export function pickFiles(
	accept: string,
	multiple: boolean,
	onPick: (files: Array<File>) => void,
): void {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = accept;
	input.multiple = multiple;
	input.onchange = () => {
		const files = Array.from(input.files ?? []);
		if (files.length > 0) onPick(files);
	};
	input.click();
}

function saveSelection(editor: LexicalEditor): BaseSelection | null {
	return editor.getEditorState().read(() => $getSelection()?.clone() ?? null);
}

/**
 * 링크. 글자를 골라 두었으면 그 글자에 걸고, 커서만 있으면 주소를 글자로 넣는다.
 * 이미 링크 안이면 푼다.
 */
export async function editLink(
	editor: LexicalEditor,
	env: EditorEnv,
	anchor: DOMRect | null,
): Promise<void> {
	const saved = saveSelection(editor);
	const inLink = editor.getEditorState().read(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return false;
		const node = selection.anchor.getNode();
		return $isLinkNode(node) || $findMatchingParent(node, $isLinkNode) !== null;
	});
	if (inLink) {
		editor.update(() => {
			if (saved) $setSelection(saved.clone());
			$toggleLink(null);
		});
		return;
	}

	const input = await env.askUrl({ kind: "link", anchor });
	if (!input) return;
	const url = normalizeUrl(input);
	if (!url) return;

	editor.update(() => {
		if (saved) $setSelection(saved.clone());
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return;
		if (selection.isCollapsed()) {
			const link = $createLinkNode(url);
			link.append($createTextNode(url));
			selection.insertNodes([link]);
		} else {
			$toggleLink(url);
		}
	});
	editor.focus();
}

/**
 * 링크로 받을 주소. 앞에 https:// 를 빼먹었으면 붙여 준다.
 * http(s) · mailto 만 받는다 — javascript: 같은 것은 링크가 아니다.
 */
export function normalizeUrl(input: string): string | null {
	const text = input.trim();
	if (!text) return null;
	if (/^mailto:/i.test(text)) return text;
	const candidate = /^[a-z][\w+.-]*:/i.test(text) ? text : `https://${text}`;
	try {
		const url = new URL(candidate);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.toString()
			: null;
	} catch {
		return null;
	}
}

/** 넣기 줄 · [+] 메뉴 · / 메뉴 · 모바일 판이 모두 이것 하나로 넣는다. */
export async function insert(
	editor: LexicalEditor,
	env: EditorEnv,
	id: InsertId,
	options: { anchor?: DOMRect | null; divider?: DividerVariant } = {},
): Promise<void> {
	const anchor = options.anchor ?? null;
	switch (id) {
		case "image":
			pickFiles("image/*", true, (files) => {
				for (const file of files) {
					editor.dispatchCommand(INSERT_IMAGE_FILE_COMMAND, file);
				}
			});
			return;
		case "imageRow":
			pickFiles("image/*", true, (files) =>
				editor.dispatchCommand(INSERT_IMAGE_ROW_COMMAND, files),
			);
			return;
		case "video":
			// .mov 도 고를 수는 있게 둔다 — 고른 뒤에 왜 안 되는지 말해 준다.
			pickFiles("video/*", false, ([file]) =>
				editor.dispatchCommand(INSERT_VIDEO_FILE_COMMAND, file),
			);
			return;
		case "embed": {
			const saved = saveSelection(editor);
			const input = await env.askUrl({ kind: "embed", anchor });
			if (!input) return;
			const embed = parseEmbed(input);
			if (!embed) {
				env.notify(env.messages.url.embedInvalid);
				return;
			}
			editor.update(() => {
				if (saved) $setSelection(saved.clone());
			});
			editor.dispatchCommand(INSERT_EMBED_COMMAND, embed);
			editor.focus();
			return;
		}
		case "quote":
			setBlock(editor, "quote");
			return;
		case "code":
			setBlock(editor, "code");
			return;
		case "divider":
			editor.dispatchCommand(INSERT_DIVIDER_COMMAND, options.divider ?? "line");
			return;
		case "table":
			// 표 플러그인의 명령을 쓰지 않는다 — 그건 빈 줄 뒤에 넣어서 표 위에 빈 칸이 남는다.
			editor.update(() => {
				const table = $createTableNodeWithDimensions(3, 3, {
					rows: true,
					columns: false,
				});
				$insertBlock(table);
				table.selectStart();
			});
			return;
		case "link":
			await editLink(editor, env, anchor);
			return;
	}
}

/** 커서가 놓인 코드블록의 언어. 안 골랐으면 null. */
export function $currentCodeLanguage(): string | null {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return null;
	const node = selection.anchor.getNode();
	const code = $isCodeNode(node)
		? node
		: $findMatchingParent(node, $isCodeNode);
	return $isCodeNode(code) ? (code.getLanguage() ?? null) : null;
}

/**
 * 코드블록의 언어를 바꾼다. plain 이면 색을 지운다 —
 * 하이라이터가 언어 없는 블록은 칠하지 않는다 (plugins/CodeHighlightPlugin.tsx).
 */
export function setCodeLanguage(editor: LexicalEditor, next: string): void {
	editor.update(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return;
		const node = selection.anchor.getNode();
		const code = $isCodeNode(node)
			? node
			: $findMatchingParent(node, $isCodeNode);
		if ($isCodeNode(code)) {
			code.setLanguage(next === PLAIN_LANGUAGE ? undefined : next);
		}
	});
}
