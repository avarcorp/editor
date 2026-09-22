import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	$getSelection,
	$isRangeSelection,
	createEditor,
	type LexicalEditor,
} from "lexical";
import { describe, expect, it } from "vitest";
import { editorTheme } from "../theme.ts";
import { $createDividerNode } from "./DividerNode.tsx";
import { editorNodes } from "./index.ts";
import { $insertBlock } from "./insert-block.ts";

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

const shape = (editor: LexicalEditor) =>
	editor.getEditorState().read(() =>
		$getRoot()
			.getChildren()
			.map((node) => `${node.getType()}:${node.getTextContent().trim()}`),
	);

const caretParent = (editor: LexicalEditor) =>
	editor.getEditorState().read(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return null;
		const node = selection.anchor.getNode();
		return $getRoot().getChildren().indexOf(node.getTopLevelElementOrThrow());
	});

describe("$insertBlock — 블록을 넣는 자리", () => {
	it("빈 줄에서 넣으면 그 줄 자리에 들어가고, 빈 줄은 아래로 밀린다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				const first = $createParagraphNode().append($createTextNode("앞 문단"));
				const empty = $createParagraphNode();
				$getRoot().append(first, empty);
				empty.select();
				$insertBlock($createDividerNode("dots"));
			},
			{ discrete: true },
		);
		expect(shape(editor)).toEqual([
			"paragraph:앞 문단",
			"divider:",
			"paragraph:",
		]);
		// 커서는 밀려난 빈 줄에 남아 이어 쓸 수 있다
		expect(caretParent(editor)).toBe(2);
	});

	it("연달아 넣으면 넣은 순서대로 쌓인다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				const empty = $createParagraphNode();
				$getRoot().append(empty);
				empty.select();
				$insertBlock($createDividerNode("line"));
				$insertBlock($createDividerNode("short"));
			},
			{ discrete: true },
		);
		expect(
			editor.getEditorState().read(() =>
				$getRoot()
					.getChildren()
					.map((node) => node.getType()),
			),
		).toEqual(["divider", "divider", "paragraph"]);
	});

	it("글이 있는 줄에서는 기본 방식대로 그 뒤에 넣는다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				const text = $createTextNode("쓰는 중");
				$getRoot().append($createParagraphNode().append(text));
				text.select(4, 4);
				$insertBlock($createDividerNode("line"));
			},
			{ discrete: true },
		);
		expect(shape(editor).slice(0, 2)).toEqual([
			"paragraph:쓰는 중",
			"divider:",
		]);
	});
});
