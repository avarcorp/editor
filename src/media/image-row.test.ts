import { describe, expect, it } from "vitest";
import {
	chunkIntoRows,
	flexGrow,
	MAX_ROW,
	moveItem,
	removeItem,
} from "./image-row.ts";

describe("chunkIntoRows — 한 번에 떨어뜨린 사진을 줄로 나눈다", () => {
	it("한 줄에 최대 3장이다", () => {
		expect(MAX_ROW).toBe(3);
	});

	it("한 장은 줄로 묶지 않는다", () => {
		expect(chunkIntoRows(["a"])).toEqual([["a"]]);
	});

	it("세 장까지는 한 줄", () => {
		expect(chunkIntoRows(["a", "b"])).toEqual([["a", "b"]]);
		expect(chunkIntoRows(["a", "b", "c"])).toEqual([["a", "b", "c"]]);
	});

	/*
	 * 3+1 로 자르면 마지막 한 장이 혼자 넓게 떨어져서 앞줄과 크기가 어긋난다.
	 * 줄마다 장수를 고르게 나눈다.
	 */
	it("넘치면 고르게 나눈다 — 한 장만 외톨이로 남기지 않는다", () => {
		expect(chunkIntoRows([1, 2, 3, 4]).map((row) => row.length)).toEqual([
			2, 2,
		]);
		expect(chunkIntoRows([1, 2, 3, 4, 5]).map((row) => row.length)).toEqual([
			3, 2,
		]);
		expect(chunkIntoRows([1, 2, 3, 4, 5, 6]).map((row) => row.length)).toEqual([
			3, 3,
		]);
		expect(
			chunkIntoRows([1, 2, 3, 4, 5, 6, 7]).map((row) => row.length),
		).toEqual([3, 2, 2]);
	});

	it("고른 순서를 지킨다", () => {
		expect(chunkIntoRows([1, 2, 3, 4, 5]).flat()).toEqual([1, 2, 3, 4, 5]);
	});

	it("빈 목록은 빈 목록이다", () => {
		expect(chunkIntoRows([])).toEqual([]);
	});
});

/*
 * 사진마다 가로세로비만큼 폭을 나눠 가지면 높이가 저절로 같아진다.
 * 다만 파노라마 한 장이 옆 사진을 손톱만 하게 만들지 않게 양 끝을 자른다.
 */
describe("flexGrow — 한 줄 안에서 차지할 몫", () => {
	it("가로세로비 그대로", () => {
		expect(flexGrow({ width: 1600, height: 900 })).toBeCloseTo(1.778, 2);
		expect(flexGrow({ width: 900, height: 1200 })).toBe(0.75);
		expect(flexGrow({ width: 1000, height: 1000 })).toBe(1);
	});

	it("아주 긴 파노라마는 잘라서 옆 사진을 지킨다", () => {
		expect(flexGrow({ width: 6000, height: 1000 })).toBe(2.5);
	});

	it("아주 긴 세로 사진도 잘라서 사라지지 않게 한다", () => {
		expect(flexGrow({ width: 200, height: 2000 })).toBe(0.5);
	});

	it("크기를 모르면 정사각형으로 본다", () => {
		expect(flexGrow({ width: 0, height: 0 })).toBe(1);
		expect(flexGrow({ width: 800, height: 0 })).toBe(1);
		expect(flexGrow({ width: Number.NaN, height: 600 })).toBe(1);
	});
});

describe("moveItem · removeItem — 줄 안에서 고치기", () => {
	it("왼쪽 오른쪽으로 옮긴다", () => {
		expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
		expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
	});

	it("끝에서 더 밀어도 그대로다", () => {
		expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
		expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
	});

	it("원본을 건드리지 않는다", () => {
		const items = ["a", "b"];
		moveItem(items, 0, 1);
		removeItem(items, 0);
		expect(items).toEqual(["a", "b"]);
	});

	it("하나를 뺀다", () => {
		expect(removeItem(["a", "b", "c"], 1)).toEqual(["a", "c"]);
	});

	it("없는 자리를 빼라고 하면 그대로다", () => {
		expect(removeItem(["a", "b"], 5)).toEqual(["a", "b"]);
	});
});
