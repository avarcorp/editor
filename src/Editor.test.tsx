// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Content, Editor, type EditorHandle } from "./Editor.tsx";
import { en } from "./messages/en.ts";
import { EditorToolbar } from "./ui/Toolbar.tsx";

// vitest 의 globals 를 끄고 쓰므로 정리를 직접 건다 — 안 하면 앞 화면이 남는다
afterEach(cleanup);

/** 글 한 줄이 든 Lexical 문서. */
function docWith(text: string): string {
	return JSON.stringify({
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
}

describe("혼자 서는 에디터", () => {
	it("children 없이도 도구 줄과 본문을 세운다", () => {
		render(<Editor messages={en} toolbar={EditorToolbar} />);

		expect(document.querySelector(".le-toolbar")).not.toBeNull();
		expect(document.querySelector("[contenteditable=true]")).not.toBeNull();
	});

	it("toolbar 를 주지 않으면 도구 줄이 없다", () => {
		render(<Editor messages={en} />);

		expect(document.querySelector(".le-toolbar")).toBeNull();
		expect(document.querySelector("[contenteditable=true]")).not.toBeNull();
	});

	it("toolbar 는 만들어 둔 요소로도 받는다", () => {
		render(
			<Editor messages={en} toolbar={<EditorToolbar className="mine" />} />,
		);

		expect(document.querySelector(".le-toolbar.mine")).not.toBeNull();
	});

	it("children 을 주면 그 배치를 그대로 쓴다 (도구 줄을 끼워 넣지 않는다)", () => {
		render(
			<Editor messages={en}>
				<p>앱이 놓은 것</p>
				<Content />
			</Editor>,
		);

		expect(screen.getByText("앱이 놓은 것")).toBeDefined();
		expect(document.querySelector(".le-toolbar")).toBeNull();
	});

	it("조립형에 슬롯을 같이 주면 타입이 막는다", () => {
		render(
			// @ts-expect-error children 과 toolbar 는 같이 못 쓴다 — 자리를 앱이 정하므로
			<Editor messages={en} toolbar={EditorToolbar}>
				<Content />
			</Editor>,
		);

		// 타입으로 막는 것이 요점이다. 실행은 children 쪽이 이긴다.
		expect(document.querySelector(".le-toolbar")).toBeNull();
	});

	it("안내 문구를 바꿔 넣는다", () => {
		render(<Editor messages={en} placeholder="Write something" />);

		expect(
			document.querySelector('[aria-placeholder="Write something"]'),
		).not.toBeNull();
	});
});

describe("손잡이", () => {
	it("빈 글을 가려낸다", () => {
		const ref = createRef<EditorHandle>();
		render(<Editor messages={en} handleRef={ref} />);

		expect(ref.current?.isEmpty()).toBe(true);
	});

	it("글이 있으면 비어 있지 않다", () => {
		const ref = createRef<EditorHandle>();
		render(<Editor messages={en} handleRef={ref} initial={docWith("안녕")} />);

		expect(ref.current?.isEmpty()).toBe(false);
		expect(ref.current?.read().plainText).toContain("안녕");
	});

	it("다른 글로 갈아 끼운다", () => {
		const ref = createRef<EditorHandle>();
		render(<Editor messages={en} handleRef={ref} initial={docWith("처음")} />);

		ref.current?.setContent(docWith("다음"));

		expect(ref.current?.read().plainText).toContain("다음");
		expect(ref.current?.read().plainText).not.toContain("처음");
	});

	it("비운다", () => {
		const ref = createRef<EditorHandle>();
		render(
			<Editor messages={en} handleRef={ref} initial={docWith("지울 글")} />,
		);

		ref.current?.clear();

		expect(ref.current?.isEmpty()).toBe(true);
	});
});
