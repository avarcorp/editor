import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	createEditor,
	type LexicalEditor,
} from "lexical";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SKIP_AUTOSAVE_TAG } from "../media/media-upload.ts";
import { $createImageNode } from "../nodes/ImageNode.tsx";
import { editorNodes } from "../nodes/index.ts";
import { editorTheme } from "../theme.ts";
import { registerAutoSave } from "./autosave.ts";

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

/** 본문을 한 번 건드린다 (사람이 한 글자 친 것에 해당). */
function edit(editor: LexicalEditor, text: string) {
	editor.update(
		() => {
			const paragraph = $createParagraphNode();
			paragraph.append($createTextNode(text));
			$getRoot().append(paragraph);
		},
		{ discrete: true },
	);
}

describe("registerAutoSave", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("가만히 두면 저장하지 않는다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		registerAutoSave(editor, { onSave, delayMs: 1500 });

		vi.advanceTimersByTime(10_000);

		expect(onSave).not.toHaveBeenCalled();
	});

	it("편집하고 조용해지면 한 번 저장한다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		registerAutoSave(editor, { onSave, delayMs: 1500 });

		edit(editor, "가");
		expect(onSave).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1500);
		expect(onSave).toHaveBeenCalledOnce();
	});

	it("계속 편집하는 동안은 미룬다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		registerAutoSave(editor, { onSave, delayMs: 1500 });

		edit(editor, "가");
		vi.advanceTimersByTime(1000);
		edit(editor, "나");
		vi.advanceTimersByTime(1000);
		expect(onSave).not.toHaveBeenCalled();

		vi.advanceTimersByTime(500);
		expect(onSave).toHaveBeenCalledOnce();
	});

	/*
	 * 한 번 저장한 뒤로 다시 안 걸리면, 이어서 쓴 글이 통째로 안 저장된다.
	 */
	it("저장한 뒤에 또 편집하면 다시 저장한다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		registerAutoSave(editor, { onSave, delayMs: 1500 });

		edit(editor, "가");
		vi.advanceTimersByTime(1500);
		expect(onSave).toHaveBeenCalledTimes(1);

		edit(editor, "나");
		vi.advanceTimersByTime(1500);
		expect(onSave).toHaveBeenCalledTimes(2);
	});

	/*
	 * 그림을 붙이는 건 조합 이벤트가 없는 편집이다. 이게 안 걸리면 붙인 사진이
	 * 저장되지 않는다 — 올릴 기회 자체가 오지 않는다.
	 */
	it("한글 조합 없이 일어난 편집도 저장한다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		registerAutoSave(editor, { onSave, delayMs: 1500 });

		editor.update(
			() => {
				$getRoot().append($createImageNode({ src: "blob:one" }));
			},
			{ discrete: true },
		);
		vi.advanceTimersByTime(1500);

		expect(onSave).toHaveBeenCalledOnce();
	});

	it("한글 조합 중에는 미뤘다가 끝난 뒤에 저장한다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		let composing = true;
		registerAutoSave(editor, {
			onSave,
			delayMs: 1500,
			isComposing: () => composing,
		});

		edit(editor, "ㅎ");
		vi.advanceTimersByTime(5000);
		expect(onSave).not.toHaveBeenCalled();

		composing = false;
		vi.advanceTimersByTime(1500);
		expect(onSave).toHaveBeenCalledOnce();
	});

	it("정리하면 예약된 저장이 취소된다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		const dispose = registerAutoSave(editor, { onSave, delayMs: 1500 });

		edit(editor, "가");
		dispose();
		vi.advanceTimersByTime(5000);

		expect(onSave).not.toHaveBeenCalled();
	});

	it("저장 함수에 에디터를 넘긴다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		registerAutoSave(editor, { onSave, delayMs: 1500 });

		edit(editor, "가");
		vi.advanceTimersByTime(1500);

		expect(onSave).toHaveBeenCalledWith(editor);
	});
});

/*
 * 저장 자체가 본문을 건드린다 — 올리는 동안 노드에 진행 표시를 쓰고, 끝나면
 * src 를 바꿔 끼운다. 그걸 사람이 친 편집으로 보면, 6초짜리 영상 하나를
 * 올리는 동안 1.5초마다 저장이 새로 뜬다. 새 글이면 id 가 아직 없어서
 * 그 저장들이 각각 새 초안을 만든다.
 */
describe("registerAutoSave — 저장이 스스로를 다시 부르지 않는다", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("저장 중에 우리가 거는 편집은 타이머를 다시 걸지 않는다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		registerAutoSave(editor, { onSave, delayMs: 1500 });

		edit(editor, "가");
		vi.advanceTimersByTime(1500);
		expect(onSave).toHaveBeenCalledTimes(1);

		// 업로드가 도는 동안 media-upload 가 노드를 여러 번 건드린다
		for (let i = 0; i < 4; i++) {
			editor.update(
				() => {
					$getRoot().append($createImageNode({ src: `blob:${i}` }));
				},
				{ discrete: true, tag: SKIP_AUTOSAVE_TAG },
			);
			vi.advanceTimersByTime(1500);
		}

		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it("그 뒤에 사람이 치면 다시 저장한다", () => {
		const editor = makeEditor();
		const onSave = vi.fn();
		registerAutoSave(editor, { onSave, delayMs: 1500 });

		editor.update(
			() => {
				$getRoot().append($createImageNode({ src: "blob:one" }));
			},
			{ discrete: true, tag: SKIP_AUTOSAVE_TAG },
		);
		vi.advanceTimersByTime(3000);
		expect(onSave).not.toHaveBeenCalled();

		edit(editor, "가");
		vi.advanceTimersByTime(1500);
		expect(onSave).toHaveBeenCalledOnce();
	});
});
