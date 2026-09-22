import { registerList } from "@lexical/list";
import { registerRichText } from "@lexical/rich-text";
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	createEditor,
	type LexicalEditor,
} from "lexical";
import { describe, expect, it } from "vitest";
import { $currentBlock, normalizeUrl, setBlock } from "./actions.ts";
import { editorNodes } from "./nodes/index.ts";
import { editorTheme } from "./theme.ts";

function makeEditor(): LexicalEditor {
	const editor = createEditor({
		namespace: "test",
		nodes: editorNodes,
		theme: editorTheme,
		onError: (error) => {
			throw error;
		},
	});
	registerRichText(editor);
	registerList(editor);
	editor.update(
		() => {
			const paragraph = $createParagraphNode();
			const text = $createTextNode("한 줄");
			paragraph.append(text);
			$getRoot().append(paragraph);
			text.select(0, 0);
		},
		{ discrete: true },
	);
	return editor;
}

const current = (editor: LexicalEditor) =>
	editor.getEditorState().read($currentBlock);

const flush = (editor: LexicalEditor) =>
	editor.update(() => {}, { discrete: true });

describe("setBlock — 문단 모양 바꾸기", () => {
	it("본문을 제목으로 바꾼다", () => {
		const editor = makeEditor();
		setBlock(editor, "h2");
		flush(editor);
		expect(current(editor)).toBe("h2");
	});

	it("같은 모양을 한 번 더 고르면 본문으로 돌아간다", () => {
		const editor = makeEditor();
		setBlock(editor, "quote");
		flush(editor);
		setBlock(editor, "quote");
		flush(editor);
		expect(current(editor)).toBe("paragraph");
	});

	it("목록도 다시 누르면 풀린다", () => {
		const editor = makeEditor();
		setBlock(editor, "numberList");
		flush(editor);
		expect(current(editor)).toBe("numberList");
		setBlock(editor, "numberList");
		flush(editor);
		expect(current(editor)).toBe("paragraph");
	});

	it("다른 모양끼리는 바로 옮겨 간다", () => {
		const editor = makeEditor();
		setBlock(editor, "h1");
		flush(editor);
		setBlock(editor, "h3");
		flush(editor);
		expect(current(editor)).toBe("h3");
	});
});

describe("normalizeUrl — 링크로 받을 주소", () => {
	it("https:// 를 빼먹었으면 붙인다", () => {
		expect(normalizeUrl("loggy.page/about")).toBe("https://loggy.page/about");
	});

	it("http · https · mailto 는 그대로 받는다", () => {
		expect(normalizeUrl("http://a.com")).toBe("http://a.com/");
		expect(normalizeUrl("mailto:hi@a.com")).toBe("mailto:hi@a.com");
	});

	it("javascript: 같은 것은 링크가 아니다", () => {
		expect(normalizeUrl("javascript:alert(1)")).toBe(null);
		expect(normalizeUrl("data:text/html,<b>")).toBe(null);
	});

	it("빈 값은 버린다", () => {
		expect(normalizeUrl("   ")).toBe(null);
	});
});
