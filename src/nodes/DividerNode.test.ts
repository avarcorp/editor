// @vitest-environment happy-dom
import { $generateHtmlFromNodes } from "@lexical/html";
import { $getRoot, createEditor, type LexicalEditor } from "lexical";
import { describe, expect, it } from "vitest";
import { editorTheme } from "../theme.ts";
import {
	$createDividerNode,
	$isDividerNode,
	DIVIDER_VARIANTS,
	registerDividerMigration,
} from "./DividerNode.tsx";
import { editorNodes } from "./index.ts";

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

function variants(editor: LexicalEditor) {
	return editor.getEditorState().read(() =>
		$getRoot()
			.getChildren()
			.map((node) =>
				$isDividerNode(node) ? node.getVariant() : node.getType(),
			),
	);
}

describe("DividerNode — 모양을 고르는 구분선", () => {
	it("다섯 가지 모양이 있다", () => {
		expect(DIVIDER_VARIANTS).toEqual([
			"line",
			"short",
			"bold",
			"dots",
			"diamond",
		]);
	});

	it("모양이 JSON 에 남고 그대로 되살아난다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append(
					$createDividerNode("dots"),
					$createDividerNode("short"),
				);
			},
			{ discrete: true },
		);
		const json = JSON.stringify(editor.getEditorState().toJSON());

		const restored = makeEditor();
		restored.setEditorState(restored.parseEditorState(json));
		expect(variants(restored)).toEqual(["dots", "short"]);
	});

	it("모르는 모양은 긴 선으로 읽는다", () => {
		const editor = makeEditor();
		const state = editor.parseEditorState(
			JSON.stringify({
				root: {
					type: "root",
					version: 1,
					children: [{ type: "divider", version: 1, variant: "zigzag" }],
					direction: null,
					format: "",
					indent: 0,
				},
			}),
		);
		editor.setEditorState(state);
		expect(variants(editor)).toEqual(["line"]);
	});

	it("독자 화면에는 모양을 data-variant 로 싣는다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append($createDividerNode("diamond"));
			},
			{ discrete: true },
		);
		const html = editor
			.getEditorState()
			.read(() => $generateHtmlFromNodes(editor, null));
		expect(html).toBe('<hr class="divider" data-variant="diamond">');
	});

	it("예전 글의 가로선(horizontalrule)은 긴 선으로 바뀐다", () => {
		const editor = makeEditor();
		editor.setEditorState(
			editor.parseEditorState(
				JSON.stringify({
					root: {
						type: "root",
						version: 1,
						children: [
							{ type: "horizontalrule", version: 1 },
							{
								type: "paragraph",
								version: 1,
								children: [],
								direction: null,
								format: "",
								indent: 0,
								textFormat: 0,
								textStyle: "",
							},
						],
						direction: null,
						format: "",
						indent: 0,
					},
				}),
			),
		);
		// 에디터가 뜬 뒤 플러그인이 붙는 순서 그대로 — 붙는 순간 있던 가로선을 바꾼다.
		registerDividerMigration(editor);
		editor.update(() => {}, { discrete: true });
		expect(variants(editor)).toEqual(["line", "paragraph"]);
	});
});
