import { describe, expect, it } from "vitest";
import {
	CODE_LANGUAGES,
	codeLanguageLabel,
	normalizeLanguage,
	PLAIN_LANGUAGE,
} from "./code-languages.ts";

describe("코드블록 언어 목록", () => {
	it("id 는 겹치지 않고, 목록에 plain 은 없다 (메뉴가 따로 그린다)", () => {
		const ids = CODE_LANGUAGES.map((language) => language.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).not.toContain(PLAIN_LANGUAGE);
	});

	it("긴 이름과 흔한 별칭을 메뉴 id 로 맞춘다", () => {
		expect(normalizeLanguage("javascript")).toBe("js");
		expect(normalizeLanguage("ts")).toBe("typescript");
		expect(normalizeLanguage("yml")).toBe("yaml");
		expect(normalizeLanguage("sh")).toBe("bash");
	});

	it("고르지 않았거나 모르는 값은 plain", () => {
		expect(normalizeLanguage(undefined)).toBe(PLAIN_LANGUAGE);
		expect(normalizeLanguage("")).toBe(PLAIN_LANGUAGE);
		expect(normalizeLanguage("brainfuck")).toBe(PLAIN_LANGUAGE);
	});

	it("이름은 목록의 것으로, plain 만 앱이 준 말로", () => {
		expect(codeLanguageLabel("dart", "일반 텍스트")).toBe("Dart");
		expect(codeLanguageLabel("javascript", "일반 텍스트")).toBe("JavaScript");
		expect(codeLanguageLabel(null, "일반 텍스트")).toBe("일반 텍스트");
	});
});
