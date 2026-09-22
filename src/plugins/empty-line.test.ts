import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createHeadingNode } from "@lexical/rich-text";
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	createEditor,
	type LexicalEditor,
} from "lexical";
import { describe, expect, it } from "vitest";
import { editorNodes } from "../nodes/index.ts";
import { editorTheme } from "../theme.ts";
import { $emptyLineKey } from "./empty-line.ts";

function makeEditor(): LexicalEditor {
	return createEditor({
		namespace: "test",
		nodes: editorNodes,
		theme: editorTheme,
		onError: (error) => {
			throw error;
		},
	});
}

function check(build: () => string | null) {
	const editor = makeEditor();
	let expected: string | null = null;
	editor.update(
		() => {
			expected = build();
		},
		{ discrete: true },
	);
	return { actual: editor.getEditorState().read($emptyLineKey), expected };
}

describe("$emptyLineKey — [+] 가 뜨는 줄", () => {
	it("빈 문단에 커서가 있으면 그 문단이다", () => {
		const { actual, expected } = check(() => {
			const paragraph = $createParagraphNode();
			$getRoot().append(paragraph);
			paragraph.select();
			return paragraph.getKey();
		});
		expect(actual).toBe(expected);
	});

	it("글자가 있는 문단에서는 뜨지 않는다", () => {
		const { actual } = check(() => {
			const paragraph = $createParagraphNode();
			const text = $createTextNode("쓰는 중");
			paragraph.append(text);
			$getRoot().append(paragraph);
			text.select(1, 1);
			return null;
		});
		expect(actual).toBe(null);
	});

	it("빈 제목 줄에서는 뜨지 않는다 — 제목을 쓰려던 자리다", () => {
		const { actual } = check(() => {
			const heading = $createHeadingNode("h2");
			$getRoot().append(heading);
			heading.select();
			return null;
		});
		expect(actual).toBe(null);
	});

	it("빈 목록 칸에서는 뜨지 않는다", () => {
		const { actual } = check(() => {
			const list = $createListNode("bullet");
			const item = $createListItemNode();
			list.append(item);
			$getRoot().append(list);
			item.select();
			return null;
		});
		expect(actual).toBe(null);
	});

	it("글자를 골라 둔 상태면 뜨지 않는다", () => {
		const { actual } = check(() => {
			const paragraph = $createParagraphNode();
			const text = $createTextNode("가나다");
			paragraph.append(text);
			$getRoot().append(paragraph, $createParagraphNode());
			text.select(0, 2);
			return null;
		});
		expect(actual).toBe(null);
	});
});
