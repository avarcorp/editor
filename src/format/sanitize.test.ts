// @vitest-environment happy-dom
import { $createCodeNode, registerCodeHighlighting } from "@lexical/code";
import { $generateHtmlFromNodes } from "@lexical/html";
import { $createLinkNode } from "@lexical/link";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	createEditor,
} from "lexical";
import { describe, expect, it } from "vitest";
import { $createDividerNode } from "../nodes/DividerNode.tsx";
import { $createEmbedNode } from "../nodes/EmbedNode.tsx";
import { $createImageNode } from "../nodes/ImageNode.tsx";
import { $createImageRowNode } from "../nodes/ImageRowNode.tsx";
import { editorNodes } from "../nodes/index.ts";
import { $createVideoNode } from "../nodes/VideoNode.tsx";
import { editorTheme } from "../theme.ts";
import { sanitizeHtml } from "./sanitize.ts";

/** 에디터가 실제로 내는 HTML. 노드 종류를 하나씩 다 넣는다. */
function editorHtml(): string {
	const editor = createEditor({
		namespace: "test",
		nodes: editorNodes,
		theme: editorTheme,
		onError: (error) => {
			throw error;
		},
	});
	editor.update(
		() => {
			const heading = $createHeadingNode("h2");
			heading.append($createTextNode("제목"));
			heading.setFormat("center");

			const paragraph = $createParagraphNode();
			const both = $createTextNode("둘다");
			both.toggleFormat("underline");
			both.toggleFormat("strikethrough");
			const link = $createLinkNode("https://a.com");
			link.append($createTextNode("링크"));
			paragraph.append(
				$createTextNode("굵게").toggleFormat("bold"),
				$createTextNode("기울임").toggleFormat("italic"),
				$createTextNode("밑줄").toggleFormat("underline"),
				$createTextNode("취소").toggleFormat("strikethrough"),
				$createTextNode("코드").toggleFormat("code"),
				both,
				link,
			);
			paragraph.setFormat("right");

			const quote = $createQuoteNode();
			quote.append($createTextNode("인용"));

			const list = (type: "bullet" | "number" | "check", checked?: boolean) => {
				const node = $createListNode(type);
				const item = $createListItemNode(checked);
				item.append($createTextNode(type));
				node.append(item);
				return node;
			};

			const code = $createCodeNode("js");
			code.append($createTextNode("const a = 1;"));

			$getRoot().append(
				heading,
				paragraph,
				quote,
				list("bullet"),
				list("number"),
				list("check", true),
				code,
				$createImageNode({
					src: "https://cdn.test/a.png",
					altText: "a",
					caption: "설명",
				}),
				$createImageRowNode({
					images: [
						{
							src: "https://cdn.test/b.png",
							altText: "b",
							width: 1600,
							height: 900,
						},
						{
							src: "https://cdn.test/c.png",
							altText: "c",
							width: 600,
							height: 800,
						},
					],
					caption: "줄",
				}),
				$createVideoNode({ src: "https://cdn.test/v.mp4", caption: "영상" }),
				$createEmbedNode({ provider: "youtube", id: "dQw4w9WgXcQ" }),
				$createEmbedNode({ provider: "vimeo", id: "76979871" }),
				$createDividerNode("dots"),
			);
		},
		{ discrete: true },
	);
	registerCodeHighlighting(editor);
	editor.update(() => {}, { discrete: true });
	return editor
		.getEditorState()
		.read(() => $generateHtmlFromNodes(editor, null));
}

describe("sanitizeHtml — 에디터가 낸 것은 그대로 둔다", () => {
	it("노드 종류를 다 넣은 글이 거의 그대로 통과한다", () => {
		const html = editorHtml();
		// 에디터 안에서만 쓰는 속성 두 개만 빠진다
		const expected = html
			.replace(' __lexicallisttype="check"', "")
			.replace(' tabindex="-1"', "");
		expect(sanitizeHtml(html)).toBe(expected);
	});

	it("정렬 · 사진 줄의 폭 몫 · 구분선 모양 · 임베드 주소가 살아 있다", () => {
		const clean = sanitizeHtml(editorHtml());
		expect(clean).toContain('style="text-align: center;"');
		expect(clean).toContain('style="flex: 0.75 1 0%"');
		expect(clean).toContain('data-variant="dots"');
		expect(clean).toContain(
			'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"',
		);
		expect(clean).toContain('src="https://player.vimeo.com/video/76979871"');
		expect(clean).toContain('class="editor-token-attr"');
	});

	it("표는 칸 모양만 남기고 에디터가 박은 인라인 스타일을 뺀다", () => {
		const table =
			'<table class="editor-table"><colgroup><col style="width: 92px;"></colgroup><tbody><tr>' +
			'<th class="editor-table-cell editor-table-cell-header" style="border: 1px solid black; width: 75px; vertical-align: top; text-align: start; background-color: rgb(242, 243, 245);" data-temporary-table-cell-lexical-key="7">' +
			'<p class="editor-paragraph"><span style="white-space: pre-wrap;">머리</span></p></th>' +
			'<td class="editor-table-cell" colspan="2" style="border: 1px solid black;"><p class="editor-paragraph"><br></p></td>' +
			"</tr></tbody></table>";
		expect(sanitizeHtml(table)).toBe(
			'<table class="editor-table"><colgroup><col></colgroup><tbody><tr>' +
				'<th class="editor-table-cell editor-table-cell-header" style="text-align: start;">' +
				'<p class="editor-paragraph"><span style="white-space: pre-wrap;">머리</span></p></th>' +
				'<td class="editor-table-cell" colspan="2"><p class="editor-paragraph"><br></p></td>' +
				"</tr></tbody></table>",
		);
	});
});

describe("sanitizeHtml — 남이 끼워 넣은 것은 뺀다", () => {
	it("script · style 은 내용째 없앤다", () => {
		expect(
			sanitizeHtml("<p>a</p><script>alert(1)</script><style>p{}</style>"),
		).toBe("<p>a</p>");
	});

	it("이벤트 속성을 뺀다", () => {
		expect(
			sanitizeHtml('<img src="https://cdn.test/a.png" onerror="alert(1)">'),
		).toBe('<img src="https://cdn.test/a.png">');
	});

	it("javascript: 링크를 무력화한다", () => {
		expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe(
			"<a>x</a>",
		);
		expect(sanitizeHtml('<a href=" JaVaScRiPt:alert(1)">x</a>')).toBe(
			"<a>x</a>",
		);
	});

	it("엔티티로 감춘 javascript: 도 막는다", () => {
		expect(sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>')).toBe(
			"<a>x</a>",
		);
		expect(sanitizeHtml('<a href="&#x6A;avascript:alert(1)">x</a>')).toBe(
			"<a>x</a>",
		);
		expect(sanitizeHtml('<a href="java&Tab;script:alert(1)">x</a>')).toBe(
			"<a>x</a>",
		);
		expect(sanitizeHtml('<a href="javascript&colon;alert(1)">x</a>')).toBe(
			"<a>x</a>",
		);
	});

	it("주소 속 & 는 그대로 오간다", () => {
		const html = '<a href="https://a.com/?a=1&amp;b=2">x</a>';
		expect(sanitizeHtml(html)).toBe(html);
	});

	it("속성 값의 따옴표로 태그를 빠져나가지 못한다", () => {
		expect(sanitizeHtml('<img alt="&quot; onerror=&quot;alert(1)">')).toBe(
			'<img alt="&quot; onerror=&quot;alert(1)">',
		);
	});

	it("사진 · 영상은 http(s) 주소만 받는다", () => {
		expect(
			sanitizeHtml('<img src="data:image/svg+xml,<svg onload=alert(1)>">'),
		).toBe("<img>");
		expect(
			sanitizeHtml('<video src="blob:https://x/1" controls></video>'),
		).toBe('<video controls=""></video>');
	});

	it("유튜브 · 비메오 재생기가 아닌 iframe 은 통째로 없앤다", () => {
		expect(
			sanitizeHtml(
				'<p>a</p><iframe src="https://evil.test/x"></iframe><p>b</p>',
			),
		).toBe("<p>a</p><p>b</p>");
		expect(
			sanitizeHtml(
				'<iframe src="https://www.youtube-nocookie.com/embed/../../evil"></iframe>',
			),
		).toBe("");
	});

	it("모르는 태그는 벗기고 글자는 남긴다", () => {
		expect(sanitizeHtml("<p><form><input>이름</form></p>")).toBe("<p>이름</p>");
	});

	it("앱의 클래스를 빌려 쓰지 못한다 — 화면을 덮는 가짜 창을 막는다", () => {
		expect(
			sanitizeHtml('<p class="fixed inset-0 z-50 editor-paragraph">x</p>'),
		).toBe('<p class="editor-paragraph">x</p>');
		expect(sanitizeHtml('<div class="fixed">x</div>')).toBe("<div>x</div>");
	});

	it("정해 둔 것 말고는 인라인 스타일을 뺀다", () => {
		expect(
			sanitizeHtml(
				'<p style="position: fixed; text-align: center; background: url(https://x)">x</p>',
			),
		).toBe('<p style="text-align: center">x</p>');
	});

	it("새 창 링크에는 opener 를 끊는다", () => {
		expect(sanitizeHtml('<a href="https://a.com" target="_blank">x</a>')).toBe(
			'<a href="https://a.com" target="_blank" rel="noopener noreferrer">x</a>',
		);
	});
});

describe("허용 목록 넓히기", () => {
	it("모르는 태그는 기본적으로 벗긴다", () => {
		expect(sanitizeHtml('<my-box class="callout">글</my-box>')).toBe("글");
	});

	it("알려 준 태그와 클래스는 남긴다", () => {
		const html = '<my-box class="callout">글</my-box>';
		expect(
			sanitizeHtml(html, {
				tags: { "my-box": ["class"] },
				classes: /^callout$/,
			}),
		).toBe(html);
	});

	it("알려 준 재생기 주소의 iframe 을 남긴다", () => {
		const html = '<iframe src="https://play.example.com/v/abc"></iframe>';
		expect(sanitizeHtml(html)).toBe("");
		expect(
			sanitizeHtml(html, {
				tags: { iframe: ["src"] },
				iframeSrc: [/^https:\/\/play\.example\.com\/v\/\w+$/],
			}),
		).toContain("play.example.com");
	});

	it("넓혀도 기본 목록은 그대로 산다", () => {
		expect(
			sanitizeHtml('<p class="editor-paragraph">글</p><script>x()</script>', {
				tags: { "my-box": ["class"] },
			}),
		).toBe('<p class="editor-paragraph">글</p>');
	});
});
