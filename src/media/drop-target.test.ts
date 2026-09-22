import { describe, expect, it } from "vitest";
import { dropIndex, dropLineY } from "./drop-target.ts";

// 문단 셋: 0~40, 58~100, 118~160 (사이 18px)
const BLOCKS = [
	{ top: 0, bottom: 40 },
	{ top: 58, bottom: 100 },
	{ top: 118, bottom: 160 },
];

describe("dropIndex — 끌어다 놓을 차례", () => {
	it("블록의 위쪽 절반이면 그 앞, 아래쪽 절반이면 그 뒤", () => {
		expect(dropIndex(BLOCKS, 10)).toBe(0);
		expect(dropIndex(BLOCKS, 30)).toBe(1);
		expect(dropIndex(BLOCKS, 70)).toBe(1);
		expect(dropIndex(BLOCKS, 90)).toBe(2);
	});

	it("블록 사이 틈은 가까운 쪽 경계로 — 틈 어디서나 같은 자리", () => {
		expect(dropIndex(BLOCKS, 45)).toBe(1);
		expect(dropIndex(BLOCKS, 55)).toBe(1);
	});

	it("맨 위보다 위면 0, 맨 아래보다 아래면 끝", () => {
		expect(dropIndex(BLOCKS, -30)).toBe(0);
		expect(dropIndex(BLOCKS, 500)).toBe(3);
	});

	it("빈 글이면 0", () => {
		expect(dropIndex([], 100)).toBe(0);
	});
});

describe("dropLineY — 선을 그을 높이", () => {
	it("두 블록 사이면 틈의 한가운데", () => {
		expect(dropLineY(BLOCKS, 1)).toBe(49);
		expect(dropLineY(BLOCKS, 2)).toBe(109);
	});

	it("맨 앞은 첫 블록 위, 맨 끝은 마지막 블록 아래로 조금 띄운다", () => {
		expect(dropLineY(BLOCKS, 0)).toBe(-6);
		expect(dropLineY(BLOCKS, 3)).toBe(166);
	});

	it("빈 글이면 0", () => {
		expect(dropLineY([], 0)).toBe(0);
	});
});
