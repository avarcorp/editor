import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 패키지는 앱을 모른다.
 *
 * 공개 패키지라서, 여기서 가져올 수 있는 건 React ·
 * Lexical · 글 정리용 xss 와 패키지 안의 파일뿐이다. 앱 코드(#/…)나 앱이 쓰는
 * 도구(라우터, React Query, 아이콘 묶음, Tailwind 도우미)를 부르는 순간 떼어 낼 수
 * 없게 된다. 코드블록 문법(prismjs, prismjs/components/*)만 예외다 — Lexical 의 코드
 * 하이라이터가 이미 prismjs 위에 서 있다.
 */
const ALLOWED = [
	/^\.{1,2}\//,
	/^react$/,
	/^react\/jsx-runtime$/,
	/^react-dom$/,
	/^lexical$/,
	/^@lexical\/[\w-]+(\/[\w-]+)?$/,
	/^xss$/,
	// 코드블록 문법. @lexical/code-prism 이 이미 prismjs 를 요구한다 (code-languages.ts)
	// 코어는 prism-global.ts 가 언어 파일보다 먼저 전역에 올린다
	/^prismjs$/,
	/^prismjs\/components\/prism-[\w-]+\.js$/,
	// 테스트만 쓰는 것
	/^vitest$/,
	/^node:/,
	/^@testing-library\/react$/,
];

const ROOT = new URL(".", import.meta.url).pathname;

function sources(dir: string): Array<string> {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sources(path);
		return /\.(ts|tsx)$/.test(name) ? [path] : [];
	});
}

function specifiers(code: string): Array<string> {
	const found: Array<string> = [];
	const pattern =
		/(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;
	for (const match of code.matchAll(pattern)) {
		found.push(match[1] ?? match[2] ?? match[3]);
	}
	return found;
}

describe("패키지 경계", () => {
	it("앱 코드와 앱 전용 도구를 가져오지 않는다", () => {
		const offenders: Array<string> = [];
		// 이 파일은 규칙을 시험하느라 금지된 이름을 글자로 품고 있다
		const self = new URL(import.meta.url).pathname;
		for (const file of sources(ROOT).filter((path) => path !== self)) {
			for (const spec of specifiers(readFileSync(file, "utf8"))) {
				if (!ALLOWED.some((rule) => rule.test(spec))) {
					offenders.push(`${relative(ROOT, file)} → ${spec}`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});

	it("훑는 규칙이 import 모양을 제대로 잡는다", () => {
		expect(
			specifiers(
				[
					'import { a } from "#/lib/x.ts";',
					"import type { B } from 'lucide-react';",
					'export { c } from "./c.ts";',
					'import "./side.css";',
					'const m = await import("@tanstack/react-query");',
				].join("\n"),
			),
		).toEqual([
			"#/lib/x.ts",
			"lucide-react",
			"./c.ts",
			"./side.css",
			"@tanstack/react-query",
		]);
	});
});
