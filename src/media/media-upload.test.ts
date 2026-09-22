import { createEmptyHistoryState, registerHistory } from "@lexical/history";
import {
	$createTableCellNode,
	$createTableNode,
	$createTableRowNode,
} from "@lexical/table";
import {
	$getRoot,
	createEditor,
	type LexicalEditor,
	UNDO_COMMAND,
} from "lexical";
import { describe, expect, it, vi } from "vitest";
import { $createImageNode, $isImageNode } from "../nodes/ImageNode.tsx";
import {
	$createImageRowNode,
	$isImageRowNode,
} from "../nodes/ImageRowNode.tsx";
import { editorNodes } from "../nodes/index.ts";
import { $createVideoNode, $isVideoNode } from "../nodes/VideoNode.tsx";
import { editorTheme } from "../theme.ts";
import { findPreviewSrcs, uploadPendingMedia } from "./media-upload.ts";
import { createPendingMedia, UploadError } from "./pending-media.ts";

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

function file(name = "cat.png", type = "image/png") {
	return new File([new Uint8Array(4)], name, { type });
}

function withImages(editor: LexicalEditor, srcs: Array<string>) {
	editor.update(
		() => {
			const root = $getRoot();
			for (const src of srcs) {
				root.append($createImageNode({ src, altText: "cat" }));
			}
		},
		{ discrete: true },
	);
}

function srcsOf(editor: LexicalEditor): Array<string> {
	return editor.getEditorState().read(() =>
		$getRoot()
			.getChildren()
			.flatMap((node) =>
				$isImageNode(node) || $isVideoNode(node) ? [node.getSrc()] : [],
			),
	);
}

describe("findPreviewSrcs", () => {
	it("아직 안 올라간 것만 집어낸다", () => {
		const editor = makeEditor();
		withImages(editor, [
			"blob:one",
			"https://cdn.example.com/already.png",
			"blob:two",
		]);

		expect(findPreviewSrcs(editor)).toEqual(["blob:one", "blob:two"]);
	});

	it("올릴 게 없으면 빈 목록이다", () => {
		const editor = makeEditor();
		withImages(editor, ["https://cdn.example.com/a.png"]);
		expect(findPreviewSrcs(editor)).toEqual([]);
	});

	it("같은 그림을 두 번 넣어도 한 번만 센다", () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one", "blob:one"]);
		expect(findPreviewSrcs(editor)).toEqual(["blob:one"]);
	});
});

describe("uploadPendingMedia — 저장 직전에 도는 단계", () => {
	it("올리고 · 주소를 받아 · 본문의 src 를 바꿔 끼운다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one"]);

		const store = createPendingMedia({
			upload: async () => "https://cdn.example.com/one.png",
			revoke: vi.fn(),
		});
		store.add("blob:one", file(), "image");

		await uploadPendingMedia(editor, store);

		expect(srcsOf(editor)).toEqual(["https://cdn.example.com/one.png"]);
		expect(findPreviewSrcs(editor)).toEqual([]);
	});

	it("같은 미리보기를 쓰는 노드가 여럿이면 전부 바뀐다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one", "blob:one"]);

		const store = createPendingMedia({
			upload: async () => "https://cdn.example.com/one.png",
			revoke: vi.fn(),
		});
		store.add("blob:one", file(), "image");

		await uploadPendingMedia(editor, store);

		expect(srcsOf(editor)).toEqual([
			"https://cdn.example.com/one.png",
			"https://cdn.example.com/one.png",
		]);
	});

	it("여러 장을 한 번에 올린다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one", "blob:two"]);

		const store = createPendingMedia({
			upload: async (f) => `https://cdn.example.com/${f.name}`,
			revoke: vi.fn(),
		});
		store.add("blob:one", file("one.png"), "image");
		store.add("blob:two", file("two.png"), "image");

		await uploadPendingMedia(editor, store);

		expect(srcsOf(editor)).toEqual([
			"https://cdn.example.com/one.png",
			"https://cdn.example.com/two.png",
		]);
	});

	it("올릴 게 없으면 아무것도 안 한다", async () => {
		const editor = makeEditor();
		withImages(editor, ["https://cdn.example.com/a.png"]);
		const upload = vi.fn();
		const store = createPendingMedia({ upload, revoke: vi.fn() });

		await uploadPendingMedia(editor, store);

		expect(upload).not.toHaveBeenCalled();
	});

	/*
	 * 여기서 blob: 을 흘리면 독자 화면에 깨진 그림이 박힌다.
	 * 본문을 직렬화하기 전에 도는 단계라, 실패는 조용히 넘어가면 안 된다.
	 */
	it("하나라도 못 올리면 저장을 막는다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one", "blob:two"]);

		const store = createPendingMedia({
			upload: async (f) => {
				if (f.name === "two.png") throw new UploadError("연결이 끊겼어요.");
				return "https://cdn.example.com/one.png";
			},
			revoke: vi.fn(),
		});
		store.add("blob:one", file("one.png"), "image");
		store.add("blob:two", file("two.png"), "image");

		await expect(uploadPendingMedia(editor, store)).rejects.toThrow(
			"연결이 끊겼어요.",
		);
	});

	it("내부 오류는 대체 문장으로 덮는다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one"]);
		const store = createPendingMedia({
			upload: async () => {
				throw new TypeError("Failed to fetch");
			},
			revoke: vi.fn(),
		});
		store.add("blob:one", file(), "image");

		await expect(uploadPendingMedia(editor, store)).rejects.toThrow(
			"파일을 올리지 못했습니다.",
		);
	});

	it("실패해도 미리보기는 본문에 남는다 — 다시 저장하면 재시도한다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one"]);

		let attempt = 0;
		const store = createPendingMedia({
			upload: async () => {
				attempt += 1;
				if (attempt === 1) throw new Error("연결이 끊겼어요.");
				return "https://cdn.example.com/one.png";
			},
			revoke: vi.fn(),
		});
		store.add("blob:one", file(), "image");

		await expect(uploadPendingMedia(editor, store)).rejects.toThrow();
		expect(srcsOf(editor)).toEqual(["blob:one"]);

		await uploadPendingMedia(editor, store);
		expect(srcsOf(editor)).toEqual(["https://cdn.example.com/one.png"]);
	});

	it("올린 뒤에는 미리보기 주소를 놓아준다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one"]);
		const revoke = vi.fn();
		const store = createPendingMedia({
			upload: async () => "https://cdn.example.com/one.png",
			revoke,
		});
		store.add("blob:one", file(), "image");

		await uploadPendingMedia(editor, store);

		expect(revoke).toHaveBeenCalledWith("blob:one");
		expect(store.size()).toBe(0);
	});

	it("본문에서 지운 그림은 올리지 않는다 — 붙였다 지우면 CDN 에 안 남는다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one"]);
		const upload = vi.fn(async () => "https://cdn.example.com/one.png");
		const store = createPendingMedia({ upload, revoke: vi.fn() });
		store.add("blob:one", file(), "image");

		// 저장 전에 마음이 바뀌어 지웠다
		editor.update(
			() => {
				for (const node of $getRoot().getChildren()) node.remove();
			},
			{ discrete: true },
		);

		await uploadPendingMedia(editor, store);

		expect(upload).not.toHaveBeenCalled();
	});

	it("영상도 같은 길로 간다", async () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append($createVideoNode({ src: "blob:clip" }));
			},
			{ discrete: true },
		);
		const store = createPendingMedia({
			upload: async (_f, { kind }) => `https://cdn.example.com/a.${kind}`,
			revoke: vi.fn(),
		});
		store.add("blob:clip", file("clip.mp4", "video/mp4"), "video");

		await uploadPendingMedia(editor, store);

		expect(srcsOf(editor)).toEqual(["https://cdn.example.com/a.video"]);
	});
});

/* ------------------------------------------------------------------ *
 * 되돌리기와의 관계
 *
 * 저장하며 바꿔 끼운 src 가 되돌리기 단계 하나로 잡히면, Cmd+Z 한 번에
 * 이미 놓아준 blob: 주소로 되돌아간다. 그 뒤로는 저장이 통째로 막힌다.
 * ------------------------------------------------------------------ */
describe("uploadPendingMedia — 되돌리기", () => {
	it("바꿔 끼운 src 는 되돌리기 단계로 남지 않는다", async () => {
		const editor = makeEditor();
		const history = createEmptyHistoryState();
		const unregister = registerHistory(editor, history, 0);
		withImages(editor, ["blob:one"]);

		const store = createPendingMedia({
			upload: async () => "https://cdn.example.com/one.png",
			revoke: vi.fn(),
		});
		store.add("blob:one", file(), "image");
		await uploadPendingMedia(editor, store);
		expect(srcsOf(editor)).toEqual(["https://cdn.example.com/one.png"]);

		editor.dispatchCommand(UNDO_COMMAND, undefined);
		await Promise.resolve();

		// 되돌아갔더라도 놓아준 주소로는 돌아가면 안 된다
		expect(srcsOf(editor)).not.toContain("blob:one");
		unregister();
	});

	it("그래도 blob: 이 되살아나면, 다시 올리지 않고 아는 주소로 바꿔 끼운다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one"]);
		const upload = vi.fn(async () => "https://cdn.example.com/one.png");
		const store = createPendingMedia({ upload, revoke: vi.fn() });
		store.add("blob:one", file(), "image");
		await uploadPendingMedia(editor, store);

		// 어떤 경로로든 옛 주소가 본문에 돌아온 상황
		editor.update(
			() => {
				for (const node of $getRoot().getChildren()) node.remove();
			},
			{ discrete: true },
		);
		withImages(editor, ["blob:one"]);

		await uploadPendingMedia(editor, store);

		expect(srcsOf(editor)).toEqual(["https://cdn.example.com/one.png"]);
		expect(upload).toHaveBeenCalledOnce();
	});
});

describe("uploadPendingMedia — 중첩된 그림", () => {
	it("표 칸 안에 있는 그림도 찾아서 올린다", async () => {
		const editor = makeEditor();
		editor.update(
			() => {
				const cell = $createTableCellNode(0);
				cell.append($createImageNode({ src: "blob:in-cell" }));
				const row = $createTableRowNode();
				row.append(cell);
				const table = $createTableNode();
				table.append(row);
				$getRoot().append(table);
			},
			{ discrete: true },
		);

		expect(findPreviewSrcs(editor)).toEqual(["blob:in-cell"]);

		const upload = vi.fn(async () => "https://cdn.example.com/cell.png");
		const store = createPendingMedia({ upload, revoke: vi.fn() });
		store.add("blob:in-cell", file(), "image");

		await uploadPendingMedia(editor, store);

		expect(upload).toHaveBeenCalledOnce();
		const serialized = JSON.stringify(editor.getEditorState().toJSON());
		expect(serialized).not.toContain("blob:");
		expect(serialized).toContain("https://cdn.example.com/cell.png");
	});
});

/* ------------------------------------------------------------------ *
 * 나란히 놓은 사진
 *
 * 줄 안의 사진도 저장할 때 올라가야 한다. 놓치면 blob: 주소가 그대로 저장돼
 * 독자에게 깨진 그림이 나간다 — 오류도 없이.
 * ------------------------------------------------------------------ */
describe("uploadPendingMedia — 나란히 놓은 사진", () => {
	function withRow(editor: LexicalEditor, srcs: Array<string>) {
		editor.update(
			() => {
				$getRoot().append(
					$createImageRowNode({
						images: srcs.map((src) => ({
							src,
							altText: "",
							width: 800,
							height: 600,
						})),
					}),
				);
			},
			{ discrete: true },
		);
	}

	function rowSrcs(editor: LexicalEditor): Array<string> {
		return editor.getEditorState().read(() => {
			const row = $getRoot().getChildren().find($isImageRowNode);
			return row ? row.getImages().map((image) => image.src) : [];
		});
	}

	it("줄 안의 미리보기를 찾아낸다", () => {
		const editor = makeEditor();
		withRow(editor, ["blob:a", "https://cdn.example.com/b.png", "blob:c"]);
		expect(findPreviewSrcs(editor)).toEqual(["blob:a", "blob:c"]);
	});

	it("줄 안의 사진을 올리고 그 자리만 바꿔 끼운다", async () => {
		const editor = makeEditor();
		withRow(editor, ["blob:a", "https://cdn.example.com/b.png", "blob:c"]);
		const store = createPendingMedia({
			upload: async (f) => `https://cdn.example.com/${f.name}`,
			revoke: vi.fn(),
		});
		store.add("blob:a", file("a.png"), "image");
		store.add("blob:c", file("c.png"), "image");

		await uploadPendingMedia(editor, store);

		// 순서와 이미 올라가 있던 사진은 그대로다
		expect(rowSrcs(editor)).toEqual([
			"https://cdn.example.com/a.png",
			"https://cdn.example.com/b.png",
			"https://cdn.example.com/c.png",
		]);
	});

	it("저장된 본문에 blob: 이 남지 않는다", async () => {
		const editor = makeEditor();
		withRow(editor, ["blob:a", "blob:b"]);
		const store = createPendingMedia({
			upload: async (f) => `https://cdn.example.com/${f.name}`,
			revoke: vi.fn(),
		});
		store.add("blob:a", file("a.png"), "image");
		store.add("blob:b", file("b.png"), "image");

		await uploadPendingMedia(editor, store);

		expect(JSON.stringify(editor.getEditorState().toJSON())).not.toContain(
			"blob:",
		);
	});

	it("같은 사진이 줄에도 있고 따로도 있으면 둘 다 바뀐다", async () => {
		const editor = makeEditor();
		withRow(editor, ["blob:a", "blob:b"]);
		withImages(editor, ["blob:a"]);
		const upload = vi.fn(
			async (f: File) => `https://cdn.example.com/${f.name}`,
		);
		const store = createPendingMedia({ upload, revoke: vi.fn() });
		store.add("blob:a", file("a.png"), "image");
		store.add("blob:b", file("b.png"), "image");

		await uploadPendingMedia(editor, store);

		expect(rowSrcs(editor)[0]).toBe("https://cdn.example.com/a.png");
		expect(srcsOf(editor)).toContain("https://cdn.example.com/a.png");
		// 한 파일은 한 번만 올린다
		expect(upload).toHaveBeenCalledTimes(2);
	});
});

/* ------------------------------------------------------------------ *
 * 올리는 도중에 들어온 사진
 *
 * 저장은 "지금 올릴 것"을 한 번 훑고 올린 뒤 본문을 직렬화한다. 그 사이에
 * 사진을 또 붙이면 그 사진은 훑은 목록에 없어서 blob: 째로 저장된다.
 * ------------------------------------------------------------------ */
describe("uploadPendingMedia — 올리는 도중에 붙인 사진", () => {
	it("도중에 들어온 사진까지 올리고 나서야 끝난다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:first"]);

		let lateAdded = false;
		const store = createPendingMedia({
			upload: async (f) => {
				// 첫 사진을 올리는 동안 사람이 사진을 하나 더 붙인다
				if (!lateAdded) {
					lateAdded = true;
					store.add("blob:late", file("late.png"), "image");
					withImages(editor, ["blob:late"]);
				}
				return `https://cdn.example.com/${f.name}`;
			},
			revoke: vi.fn(),
		});
		store.add("blob:first", file("first.png"), "image");

		await uploadPendingMedia(editor, store);

		expect(findPreviewSrcs(editor)).toEqual([]);
		expect(JSON.stringify(editor.getEditorState().toJSON())).not.toContain(
			"blob:",
		);
	});
});

/* ------------------------------------------------------------------ *
 * 파일이 사라진 미리보기
 *
 * 새로고침하면 대기실이 비고 blob: 주소는 죽는다. 그런 주소가 본문에 남아
 * 있으면 "올릴 파일을 찾지 못했어요"로 저장이 영영 막힌다 — 그 뒤로 쓰는
 * 글이 하나도 저장되지 않는다. 되살릴 길이 없는 사진은 빼고 저장을 잇는다.
 * ------------------------------------------------------------------ */
describe("uploadPendingMedia — 되살릴 수 없는 미리보기", () => {
	it("파일이 없는 사진은 빼고 저장을 막지 않는다", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:dead", "blob:alive"]);
		const store = createPendingMedia({
			upload: async (f) => `https://cdn.example.com/${f.name}`,
			revoke: vi.fn(),
		});
		store.add("blob:alive", file("alive.png"), "image");

		const result = await uploadPendingMedia(editor, store);

		expect(result.dropped).toBe(1);
		expect(srcsOf(editor)).toEqual(["https://cdn.example.com/alive.png"]);
	});

	it("줄 안의 죽은 사진도 뺀다 — 한 장 남으면 보통 사진이 된다", async () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append(
					$createImageRowNode({
						images: [
							{ src: "blob:dead", altText: "", width: 1, height: 1 },
							{ src: "blob:alive", altText: "", width: 1, height: 1 },
						],
					}),
				);
			},
			{ discrete: true },
		);
		const store = createPendingMedia({
			upload: async (f) => `https://cdn.example.com/${f.name}`,
			revoke: vi.fn(),
		});
		store.add("blob:alive", file("alive.png"), "image");

		const result = await uploadPendingMedia(editor, store);

		expect(result.dropped).toBe(1);
		expect(srcsOf(editor)).toEqual(["https://cdn.example.com/alive.png"]);
		expect(JSON.stringify(editor.getEditorState().toJSON())).not.toContain(
			"blob:",
		);
	});

	it("이미 올린 주소는 죽은 것으로 보지 않는다 — 되돌리기로 돌아온 경우", async () => {
		const editor = makeEditor();
		withImages(editor, ["blob:one"]);
		const store = createPendingMedia({
			upload: async () => "https://cdn.example.com/one.png",
			revoke: vi.fn(),
		});
		store.add("blob:one", file(), "image");
		await uploadPendingMedia(editor, store);

		// 되돌리기 등으로 옛 주소가 돌아왔다
		editor.update(
			() => {
				for (const node of $getRoot().getChildren()) node.remove();
			},
			{ discrete: true },
		);
		withImages(editor, ["blob:one"]);

		const result = await uploadPendingMedia(editor, store);
		expect(result.dropped).toBe(0);
		expect(srcsOf(editor)).toEqual(["https://cdn.example.com/one.png"]);
	});
});
