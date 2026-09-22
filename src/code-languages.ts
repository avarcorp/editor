/**
 * 코드블록에 고를 수 있는 언어.
 *
 * Prism 이 실제로 읽을 수 있는 것만 둔다 (문법은 CodeHighlightPlugin 이 싣는다).
 * 고르지 않으면 `plain` — 색을 입히지 않고 본문 색 그대로 둔다.
 */

export type CodeLanguage = { id: string; label: string };

export const PLAIN_LANGUAGE = "plain";

/** 목록 순서가 메뉴 순서다. 자주 쓰는 것부터. */
export const CODE_LANGUAGES: ReadonlyArray<CodeLanguage> = [
	{ id: "js", label: "JavaScript" },
	{ id: "typescript", label: "TypeScript" },
	{ id: "dart", label: "Dart" },
	{ id: "json", label: "JSON" },
	{ id: "yaml", label: "YAML" },
	{ id: "bash", label: "Bash" },
	{ id: "html", label: "HTML" },
	{ id: "css", label: "CSS" },
	{ id: "sql", label: "SQL" },
	{ id: "py", label: "Python" },
	{ id: "go", label: "Go" },
	{ id: "java", label: "Java" },
	{ id: "kotlin", label: "Kotlin" },
	{ id: "swift", label: "Swift" },
	{ id: "diff", label: "Diff" },
];

/**
 * 코드블록이 들고 있는 값을 메뉴의 id 로 맞춘다.
 * 언어를 안 고른 블록은 undefined 이고, 옛 글에는 javascript 같은 긴 이름도 있다.
 */
export function normalizeLanguage(value: string | null | undefined): string {
	if (!value) return PLAIN_LANGUAGE;
	const alias: Record<string, string> = {
		javascript: "js",
		jsx: "js",
		ts: "typescript",
		tsx: "typescript",
		markup: "html",
		xml: "html",
		python: "py",
		golang: "go",
		plaintext: PLAIN_LANGUAGE,
		text: PLAIN_LANGUAGE,
		shell: "bash",
		sh: "bash",
		yml: "yaml",
	};
	const id = alias[value] ?? value;
	return CODE_LANGUAGES.some((language) => language.id === id)
		? id
		: PLAIN_LANGUAGE;
}

/** 메뉴와 코드블록 오른쪽 위에 보이는 이름. plain 은 앱이 준 말로 (문구는 패키지 밖). */
export function codeLanguageLabel(
	value: string | null | undefined,
	plainLabel: string,
): string {
	const id = normalizeLanguage(value);
	if (id === PLAIN_LANGUAGE) return plainLabel;
	return (
		CODE_LANGUAGES.find((language) => language.id === id)?.label ?? plainLabel
	);
}
