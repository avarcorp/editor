// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	UNDO_COMMAND,
} from "lexical";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { en } from "./messages/en.ts";
import { $createDividerNode } from "./nodes/DividerNode.tsx";

afterEach(cleanup);

/** 본문에 한 줄 적는다 — 사람이 친 것과 같은 자리에서 자동저장이 깨어난다. */
function type(handle: EditorHandle | null, text: string) {
	handle?.lexical()?.update(
		() => {
			const paragraph = $createParagraphNode();
			paragraph.append($createTextNode(text));
			$getRoot().append(paragraph);
		},
		{ discrete: true },
	);
}

describe("자동저장은 부모가 다시 그려도 살아 있다", () => {
	it("문구 객체를 새로 만들어 넘겨도 예약이 풀리지 않는다", async () => {
		vi.useFakeTimers();
		try {
			const onAutoSave = vi.fn();
			const ref = createRef<EditorHandle>();
			// 앱이 흔히 쓰는 모양 — 렌더마다 새 객체
			const inline = () => ({ ...en, placeholder: "Write" });

			const view = render(
				<Editor
					messages={inline()}
					handleRef={ref}
					onAutoSave={onAutoSave}
					autoSaveDelay={1000}
				/>,
			);

			type(ref.current, "안녕");
			// 저장이 예약된 뒤, 기다리는 동안 부모가 몇 번 다시 그린다
			for (let i = 0; i < 3; i++) {
				view.rerender(
					<Editor
						messages={inline()}
						handleRef={ref}
						onAutoSave={onAutoSave}
						autoSaveDelay={1000}
					/>,
				);
				await vi.advanceTimersByTimeAsync(200);
			}
			await vi.advanceTimersByTimeAsync(1200);

			expect(onAutoSave).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("글자 수 알림", () => {
	it("렌더마다 새 함수를 넘겨도 다시 재지 않는다", () => {
		const onStats = vi.fn();
		const view = render(<Editor messages={en} onStats={(s) => onStats(s)} />);

		const first = onStats.mock.calls.length;
		view.rerender(<Editor messages={en} onStats={(s) => onStats(s)} />);
		view.rerender(<Editor messages={en} onStats={(s) => onStats(s)} />);

		// 마운트에서 한 번이면 충분하다 — 다시 그렸다고 또 부르면 setState 와 물려 무한 루프가 된다
		expect(onStats.mock.calls.length).toBe(first);
	});
});

describe("읽기 전용 전환", () => {
	it("editable 을 바꾸면 본문도 따라간다", () => {
		const view = render(<Editor messages={en} editable={false} />);
		expect(document.querySelector("[contenteditable=false]")).not.toBeNull();

		view.rerender(<Editor messages={en} editable={true} />);
		expect(document.querySelector("[contenteditable=true]")).not.toBeNull();
	});
});

describe("글을 갈아 끼울 때", () => {
	const doc = (text: string) =>
		JSON.stringify({
			root: {
				children: [
					{
						children: [
							{
								detail: 0,
								format: 0,
								mode: "normal",
								style: "",
								text,
								type: "text",
								version: 1,
							},
						],
						direction: "ltr",
						format: "",
						indent: 0,
						type: "paragraph",
						version: 1,
					},
				],
				direction: "ltr",
				format: "",
				indent: 0,
				type: "root",
				version: 1,
			},
		});

	it("앞 글이 되돌리기로 돌아오지 않는다", () => {
		const ref = createRef<EditorHandle>();
		render(<Editor messages={en} handleRef={ref} initial={doc("앞 글")} />);

		ref.current?.setContent(doc("다음 글"));
		const editor = ref.current?.lexical();
		editor?.dispatchCommand(UNDO_COMMAND, undefined);

		expect(ref.current?.read().plainText).not.toContain("앞 글");
	});
});

describe("빈 글 판정", () => {
	it("글자가 없어도 구분선 하나가 있으면 빈 글이 아니다", () => {
		const ref = createRef<EditorHandle>();
		render(<Editor messages={en} handleRef={ref} />);

		ref.current?.lexical()?.update(
			() => {
				$getRoot().append($createDividerNode("line"));
			},
			{ discrete: true },
		);

		expect(ref.current?.isEmpty()).toBe(false);
	});
});
