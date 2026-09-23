import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as ReactJSXRuntime from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import { build, type Rolldown } from "vite";
import { describe, expect, it } from "vitest";

/**
 * 빌드한 dist 를 앱이 쓰는 방식 그대로 불러 Prism 문법이 등록되는지 본다.
 *
 * prismjs/components/* 는 전역 Prism 이 먼저 있어야 도는 스크립트라, 번들러나
 * 런타임이 평가 순서를 바꾸면 모듈을 여는 순간 `Prism is not defined` 로 죽는다
 * (#5). 개발 서버에서는 드러나지 않으므로 프로덕션 번들과 Node 를 직접 돌린다.
 * src 가 아니라 dist 를 본다 — package.json 의 sideEffects 가 결과를 바꾼다.
 */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ENTRY = fileURLToPath(new URL("./fixtures/entry.js", import.meta.url));

// @lexical/code-prism 이 싣는 것과 CodeHighlightPlugin 이 더 싣는 것
const LANGUAGES = [
	"clike",
	"javascript",
	"typescript",
	"diff",
	"go",
	"bash",
	"dart",
	"json",
	"kotlin",
	"yaml",
];

const REACT_GLOBALS = {
	react: "React",
	"react-dom": "ReactDOM",
	"react/jsx-runtime": "ReactJSXRuntime",
};

/** Vite 8(Rolldown) 프로덕션 빌드. 앱 번들처럼 React 만 밖에 둔다. */
async function bundle(): Promise<string> {
	const result = await build({
		configFile: false,
		logLevel: "silent",
		mode: "production",
		root: ROOT,
		resolve: { alias: { "@avarlabs/editor": ROOT } },
		build: {
			write: false,
			lib: { entry: ENTRY, formats: ["iife"], name: "EditorEntry" },
			rollupOptions: {
				external: (id) => /^react(-dom)?(\/|$)/.test(id),
				output: { globals: REACT_GLOBALS },
			},
		},
	});
	const [output] = result as Array<Rolldown.RolldownOutput>;
	const chunk = output.output.find((file) => file.type === "chunk");
	if (!chunk) throw new Error("빌드 결과에 청크가 없다");
	return chunk.code;
}

describe("Prism 평가 순서", () => {
	it("Vite 프로덕션 번들을 브라우저에서 열어도 문법이 모두 등록된다", async () => {
		const code = await bundle();
		const { window } = new JSDOM("", { runScripts: "outside-only" });
		Object.assign(window, { React, ReactDOM, ReactJSXRuntime });

		window.eval(code);

		const scope = window as unknown as {
			__editor: string;
			Prism: { languages: Record<string, unknown> };
		};
		expect(scope.__editor).toBe("function");
		expect(LANGUAGES.filter((id) => !scope.Prism.languages[id])).toEqual([]);
	}, 60_000);

	it.each([
		"production",
		"development",
	])("Node(%s) 에서 dist 를 바로 import 해도 문법이 모두 등록된다", (env) => {
		// SSR 서버가 하는 일. @lexical/code-prism 의 Node 빌드는 top-level await 를 쓴다
		const script = `
			const m = await import(${JSON.stringify(`${ROOT}dist/index.js`)});
			const missing = ${JSON.stringify(LANGUAGES)}.filter((id) => !globalThis.Prism?.languages[id]);
			console.log(JSON.stringify({ editor: typeof m.Editor, missing }));
		`;
		const stdout = execFileSync(
			process.execPath,
			["--input-type=module", "-e", script],
			{ cwd: ROOT, env: { ...process.env, NODE_ENV: env }, encoding: "utf8" },
		);

		expect(JSON.parse(stdout)).toEqual({ editor: "function", missing: [] });
	});
});
