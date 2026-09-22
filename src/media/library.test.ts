import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	createEditor,
	type LexicalEditor,
} from "lexical";
import { describe, expect, it } from "vitest";
import { $isImageNode } from "../nodes/ImageNode.tsx";
import { $isImageRowNode } from "../nodes/ImageRowNode.tsx";
import { editorNodes } from "../nodes/index.ts";
import { $isVideoNode } from "../nodes/VideoNode.tsx";
import { editorTheme } from "../theme.ts";
import { $insertMedia, canLayoutAsRow, type MediaRef } from "./library.ts";
import { listMediaSrcs } from "./media-upload.ts";

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

/** 맨 위 자식을 "종류:src" 로. 줄이면 안의 사진을 + 로 잇는다. */
const shape = (editor: LexicalEditor) =>
	editor.getEditorState().read(() =>
		$getRoot()
			.getChildren()
			.map((node) => {
				if ($isImageNode(node)) return `image:${node.getSrc()}`;
				if ($isVideoNode(node)) return `video:${node.getSrc()}`;
				if ($isImageRowNode(node))
					return `row:${node
						.getImages()
						.map((image) => image.src)
						.join("+")}`;
				return `${node.getType()}:${node.getTextContent()}`;
			}),
	);

const img = (n: number, size = { width: 400, height: 300 }): MediaRef => ({
	kind: "image",
	src: `https://cdn.test/${n}.jpg`,
	alt: `${n}.jpg`,
	...size,
});
const vid = (n: number): MediaRef => ({
	kind: "video",
	src: `https://cdn.test/${n}.mp4`,
});

/** 문단 둘. 두 번째 빈 줄에 커서. */
function withEmptyLine(editor: LexicalEditor) {
	editor.update(
		() => {
			const first = $createParagraphNode().append($createTextNode("앞"));
			const empty = $createParagraphNode();
			$getRoot().append(first, empty);
			empty.select();
		},
		{ discrete: true },
	);
}

describe("$insertMedia — 이미 올라간 미디어를 본문에 넣기", () => {
	it("하나씩 넣으면 고른 차례대로, 빈 줄 자리에 쌓인다", () => {
		const editor = makeEditor();
		withEmptyLine(editor);
		editor.update(() => $insertMedia([img(1), vid(2), img(3)], "sequence"), {
			discrete: true,
		});
		expect(shape(editor)).toEqual([
			"paragraph:앞",
			"image:https://cdn.test/1.jpg",
			"video:https://cdn.test/2.mp4",
			"image:https://cdn.test/3.jpg",
			"paragraph:",
		]);
	});

	it("나란히 넣으면 한 줄로 묶는다. 넘치면 줄 수를 먼저 정해 고르게 나눈다", () => {
		const editor = makeEditor();
		withEmptyLine(editor);
		editor.update(() => $insertMedia([img(1), img(2), img(3), img(4)], "row"), {
			discrete: true,
		});
		expect(shape(editor)).toEqual([
			"paragraph:앞",
			"row:https://cdn.test/1.jpg+https://cdn.test/2.jpg",
			"row:https://cdn.test/3.jpg+https://cdn.test/4.jpg",
			"paragraph:",
		]);
	});

	it("나란히 넣을 때 원본 크기를 줄에 싣는다. 모르면 0 — 줄은 정사각형으로 본다", () => {
		const editor = makeEditor();
		withEmptyLine(editor);
		editor.update(
			() =>
				$insertMedia(
					[img(1, { width: 1200, height: 800 }), { kind: "image", src: "u" }],
					"row",
				),
			{ discrete: true },
		);
		const images = editor.getEditorState().read(() => {
			const row = $getRoot().getChildren()[1];
			return $isImageRowNode(row) ? row.getImages() : [];
		});
		expect(images.map(({ width, height }) => [width, height])).toEqual([
			[1200, 800],
			[0, 0],
		]);
	});

	it("자리를 주면(끌어다 놓기) 커서가 아니라 그 차례에 넣는다", () => {
		const editor = makeEditor();
		withEmptyLine(editor);
		editor.update(() => $insertMedia([img(1)], "sequence", 0), {
			discrete: true,
		});
		expect(shape(editor)).toEqual([
			"image:https://cdn.test/1.jpg",
			"paragraph:앞",
			"paragraph:",
		]);
	});

	it("맨 끝 차례를 주면 마지막 블록 뒤에 붙인다", () => {
		const editor = makeEditor();
		withEmptyLine(editor);
		editor.update(() => $insertMedia([img(1), img(2)], "sequence", 2), {
			discrete: true,
		});
		expect(shape(editor).slice(2)).toEqual([
			"image:https://cdn.test/1.jpg",
			"image:https://cdn.test/2.jpg",
		]);
	});

	it("커서가 없으면(아직 본문을 누르지 않았으면) 글 끝에 붙인다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append($createParagraphNode().append($createTextNode("앞")));
			},
			{ discrete: true },
		);
		editor.update(() => $insertMedia([img(1)], "sequence"), {
			discrete: true,
		});
		expect(shape(editor)).toEqual([
			"paragraph:앞",
			"image:https://cdn.test/1.jpg",
		]);
	});

	it("넣은 주소는 본문의 미디어 목록에 잡힌다 — 줄 안의 사진까지", () => {
		const editor = makeEditor();
		withEmptyLine(editor);
		editor.update(
			() => {
				$insertMedia([img(1), img(2)], "row");
				$insertMedia([vid(3)], "sequence");
			},
			{ discrete: true },
		);
		expect([...listMediaSrcs(editor)].sort()).toEqual([
			"https://cdn.test/1.jpg",
			"https://cdn.test/2.jpg",
			"https://cdn.test/3.mp4",
		]);
	});
});

describe("canLayoutAsRow — 나란히 넣을 수 있나", () => {
	it("사진이 두 장 이상이고 영상이 없어야 한다", () => {
		expect(canLayoutAsRow([img(1), img(2)])).toBe(true);
		expect(canLayoutAsRow([img(1)])).toBe(false);
		expect(canLayoutAsRow([img(1), img(2), vid(3)])).toBe(false);
		expect(canLayoutAsRow([])).toBe(false);
	});
});
