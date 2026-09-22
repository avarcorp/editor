import { describe, expect, it } from "vitest";
import { en } from "../messages/en.ts";
import { ko } from "../messages/ko.ts";
import { filterItems, insertItems, slashItems } from "./menu-items.ts";

const ids = (items: Array<{ id: string }>) => items.map((item) => item.id);

describe("메뉴 항목", () => {
	it("넣기 목록은 넣기 줄과 같은 순서다", () => {
		expect(ids(insertItems(ko))).toEqual([
			"image",
			"imageRow",
			"video",
			"embed",
			"quote",
			"divider",
			"code",
			"table",
		]);
	});

	it("/ 메뉴는 문단 모양이 앞, 넣을 것이 뒤다", () => {
		const all = ids(slashItems(ko));
		expect(all.slice(0, 4)).toEqual(["paragraph", "h1", "h2", "h3"]);
		expect(all.at(-1)).toBe("table");
		expect(new Set(all).size).toBe(all.length);
	});

	it("구분선만 모양을 한 번 더 고른다", () => {
		expect(
			slashItems(ko)
				.filter((item) => item.submenu)
				.map((item) => item.id),
		).toEqual(["divider"]);
	});

	it("이름은 고른 언어로 나온다", () => {
		expect(insertItems(en)[1].label).toBe("Photo row");
		expect(insertItems(ko)[1].label).toBe("사진 나란히");
	});
});

describe("filterItems — / 뒤에 친 말로 거르기", () => {
	it("한글로 찾는다", () => {
		expect(ids(filterItems(slashItems(ko), "제목"))).toEqual([
			"h1",
			"h2",
			"h3",
		]);
	});

	it("영문으로도 찾는다", () => {
		expect(ids(filterItems(slashItems(ko), "table"))).toEqual(["table"]);
	});

	it("이름의 일부로도 찾는다", () => {
		expect(ids(filterItems(slashItems(ko), "나란"))).toEqual(["imageRow"]);
	});

	it("아무것도 안 쳤으면 전부다", () => {
		expect(filterItems(slashItems(ko), "")).toHaveLength(slashItems(ko).length);
	});
});
