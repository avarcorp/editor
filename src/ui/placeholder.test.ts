import { describe, expect, it } from "vitest";
import { placeholderParts, placeholderText } from "./placeholder.ts";

describe("placeholderParts — 빈 문서 안내의 `…` 는 키 모양으로", () => {
	it("백틱으로 감싼 부분만 키로 가른다", () => {
		expect(
			placeholderParts(
				"이야기를 작성해보세요. `/` 를 누르면 블록을 넣을 수 있습니다.",
			),
		).toEqual([
			{ key: false, text: "이야기를 작성해보세요. " },
			{ key: true, text: "/" },
			{ key: false, text: " 를 누르면 블록을 넣을 수 있습니다." },
		]);
	});

	it("백틱이 없으면 통째로 글", () => {
		expect(placeholderParts("Start writing.")).toEqual([
			{ key: false, text: "Start writing." },
		]);
	});

	it("읽어 주는 문구(aria)에는 백틱을 뺀다", () => {
		expect(placeholderText("`/` 를 누르세요")).toBe("/ 를 누르세요");
	});
});
