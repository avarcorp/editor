import { describe, expect, it } from "vitest";
import { measureText } from "./stats.ts";

describe("measureText", () => {
	it("공백은 글자 수에서 뺀다", () => {
		expect(measureText("가 나\n다").chars).toBe(3);
	});

	it("짧은 글도 최소 1분이다", () => {
		expect(measureText("").minutes).toBe(1);
	});

	it("한글은 분당 500자로 본다", () => {
		expect(measureText("가".repeat(1000)).minutes).toBe(2);
	});

	it("영문은 분당 200단어로 본다", () => {
		expect(measureText(Array(400).fill("word").join(" ")).minutes).toBe(2);
	});
});
