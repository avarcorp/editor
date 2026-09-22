import { $getRoot, createEditor, type LexicalEditor } from "lexical";
import { describe, expect, it } from "vitest";
import { editorTheme } from "../theme.ts";
import { $isImageNode } from "./ImageNode.tsx";
import {
	$createImageRowNode,
	$isImageRowNode,
	type RowImage,
} from "./ImageRowNode.tsx";
import { editorNodes } from "./index.ts";

function makeEditor(): LexicalEditor {
	return createEditor({
		namespace: "blog",
		nodes: editorNodes,
		theme: editorTheme,
		onError: (error) => {
			throw error;
		},
	});
}

const img = (src: string, width = 800, height = 600): RowImage => ({
	src,
	altText: src,
	width,
	height,
});

function withRow(editor: LexicalEditor, images: Array<RowImage>, caption = "") {
	editor.update(
		() => {
			$getRoot().append($createImageRowNode({ images, caption }));
		},
		{ discrete: true },
	);
}

function blocks(editor: LexicalEditor) {
	return editor.getEditorState().read(() =>
		$getRoot()
			.getChildren()
			.map((node) =>
				$isImageRowNode(node)
					? { type: "row", srcs: node.getImages().map((i) => i.src) }
					: $isImageNode(node)
						? { type: "image", src: node.getSrc() }
						: { type: node.getType() },
			),
	);
}

function edit(editor: LexicalEditor, fn: () => void) {
	editor.update(fn, { discrete: true });
}

describe("ImageRowNode — 줄 안에서 고치기", () => {
	it("한 장을 빼면 나머지가 남는다", () => {
		const editor = makeEditor();
		withRow(editor, [img("a"), img("b"), img("c")]);
		edit(editor, () => {
			const row = $getRoot().getFirstChild();
			if ($isImageRowNode(row)) row.removeImageAt(1);
		});
		expect(blocks(editor)).toEqual([{ type: "row", srcs: ["a", "c"] }]);
	});

	/*
	 * 한 장짜리 줄은 폭만 좁고 줄로서 할 일이 없다. 보통 사진으로 되돌린다.
	 */
	it("한 장만 남으면 보통 사진이 된다 — 설명도 따라간다", () => {
		const editor = makeEditor();
		withRow(editor, [img("a"), img("b")], "여행 사진");
		edit(editor, () => {
			const row = $getRoot().getFirstChild();
			if ($isImageRowNode(row)) row.removeImageAt(0);
		});
		expect(blocks(editor)).toEqual([{ type: "image", src: "b" }]);
		const caption = editor.getEditorState().read(() => {
			const node = $getRoot().getFirstChild();
			return $isImageNode(node) ? node.getTextContent() : null;
		});
		expect(caption).toBe("여행 사진");
	});

	it("따로 놓으면 순서대로 한 장씩 선다", () => {
		const editor = makeEditor();
		withRow(editor, [img("a"), img("b"), img("c")]);
		edit(editor, () => {
			const row = $getRoot().getFirstChild();
			if ($isImageRowNode(row)) row.unpack();
		});
		expect(blocks(editor)).toEqual([
			{ type: "image", src: "a" },
			{ type: "image", src: "b" },
			{ type: "image", src: "c" },
		]);
	});

	it("따로 놓아도 설명을 잃지 않는다 — 마지막 사진 아래로 간다", () => {
		const editor = makeEditor();
		withRow(editor, [img("a"), img("b")], "묶음 설명");
		edit(editor, () => {
			const row = $getRoot().getFirstChild();
			if ($isImageRowNode(row)) row.unpack();
		});
		const captions = editor.getEditorState().read(() =>
			$getRoot()
				.getChildren()
				.map((node) => ($isImageNode(node) ? node.getTextContent() : null)),
		);
		// 설명이 없는 사진은 altText 를 본문 글자로 내놓는다
		expect(captions).toEqual(["a", "묶음 설명"]);
	});
});

describe("ImageRowNode — 저장했다 다시 열기", () => {
	it("JSON 으로 저장했다 되살리면 그대로다", () => {
		const editor = makeEditor();
		withRow(editor, [img("a", 1600, 900), img("b", 900, 1200)], "설명");
		const json = JSON.stringify(editor.getEditorState().toJSON());

		const reopened = makeEditor();
		reopened.setEditorState(reopened.parseEditorState(json));

		const row = reopened.getEditorState().read(() => {
			const node = $getRoot().getFirstChild();
			return $isImageRowNode(node)
				? { images: node.getImages(), text: node.getTextContent() }
				: null;
		});
		expect(row).toEqual({
			images: [img("a", 1600, 900), img("b", 900, 1200)],
			text: "설명",
		});
	});

	it("올리는 중 표시는 저장되지 않는다", () => {
		const editor = makeEditor();
		withRow(editor, [img("blob:a"), img("b")]);
		edit(editor, () => {
			const row = $getRoot().getFirstChild();
			if ($isImageRowNode(row)) row.setImageUploading("blob:a", true);
		});
		expect(JSON.stringify(editor.getEditorState().toJSON())).not.toContain(
			"uploading",
		);
	});

	it("옛 글에 크기가 없어도 열린다", () => {
		const editor = makeEditor();
		const json = JSON.stringify({
			root: {
				children: [
					{
						type: "image-row",
						version: 1,
						images: [{ src: "a" }, { src: "b", altText: "b" }],
						caption: "",
					},
				],
				direction: null,
				format: "",
				indent: 0,
				type: "root",
				version: 1,
			},
		});
		editor.setEditorState(editor.parseEditorState(json));
		const images = editor.getEditorState().read(() => {
			const node = $getRoot().getFirstChild();
			return $isImageRowNode(node) ? node.getImages() : null;
		});
		expect(images).toEqual([
			{ src: "a", altText: "", width: 0, height: 0 },
			{ src: "b", altText: "b", width: 0, height: 0 },
		]);
	});
});
