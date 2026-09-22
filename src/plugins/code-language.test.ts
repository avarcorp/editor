// @vitest-environment happy-dom
import { $createCodeNode, registerCodeHighlighting } from "@lexical/code";
import { $generateHtmlFromNodes } from "@lexical/html";
import { $createTextNode, $getRoot, createEditor } from "lexical";
import { describe, expect, it } from "vitest";
import { CODE_LANGUAGES } from "../code-languages.ts";
import { editorNodes } from "../nodes/index.ts";
import { editorTheme } from "../theme.ts";
import { PLAIN_FIRST_TOKENIZER } from "./CodeHighlightPlugin.tsx";

/**
 * 코드블록에 언어를 고르지 않았으면 색을 입히지 않는다.
 *
 * Prism 기본값은 JavaScript 다. 주소를 붙여 넣으면 `//` 뒤가 통째로 주석(회색)이
 * 되어 읽을 수 없었다 — 블로그 글에 붙는 건 JS 보다 URL · JSON · 로그가 많다.
 */
function codeHtml(text: string, language?: string): string {
	const editor = createEditor({
		nodes: editorNodes,
		theme: editorTheme,
		onError: (error) => {
			throw error;
		},
	});
	editor.update(
		() => {
			const code = $createCodeNode(language);
			code.append($createTextNode(text));
			$getRoot().append(code);
		},
		{ discrete: true },
	);
	registerCodeHighlighting(editor, PLAIN_FIRST_TOKENIZER);
	editor.update(() => {}, { discrete: true });
	return editor
		.getEditorState()
		.read(() => $generateHtmlFromNodes(editor, null));
}

describe("코드블록 기본 언어", () => {
	const url = "https://go.onelink.me/uFHB?af_dp=goodjobapp";

	it("언어를 안 고르면 색을 입히지 않는다", () => {
		const html = codeHtml(url);
		expect(html).toContain(url);
		expect(html).not.toContain("editor-token-");
		// 언어 딱지도 붙지 않는다 (::before 가 읽는 값)
		expect(html).not.toContain('data-highlight-language="javascript"');
	});

	it("언어를 고르면 그대로 칠한다", () => {
		const html = codeHtml("const a = 1;", "js");
		expect(html).toContain("editor-token-");
		expect(html).toContain('data-highlight-language="js"');
	});

	it("메뉴에 있는 언어는 모두 Prism 이 읽는다", () => {
		// 문법을 안 실으면 색이 하나도 안 붙는다 — 목록에만 있고 동작하지 않는 언어를 막는다
		const sample: Record<string, string> = {
			js: "const a = 1;",
			typescript: "const a: number = 1;",
			dart: "final a = 1;",
			json: '{ "a": 1 }',
			yaml: "a: 1",
			bash: "echo 'hi'",
			html: "<p>hi</p>",
			css: "a { color: red; }",
			sql: "select 1;",
			py: "a = 1",
			go: "var a = 1",
			java: "int a = 1;",
			kotlin: "val a = 1",
			swift: "let a = 1",
			diff: "+ added",
		};
		for (const { id } of CODE_LANGUAGES) {
			expect(codeHtml(sample[id] ?? "a", id), id).toContain("editor-token-");
		}
	});
});
