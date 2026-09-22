/**
 * 빈 문서 안내 문구. 백틱으로 감싼 부분(`/`)은 키 모양으로 그린다 —
 * 문구는 문자열 하나로 두고(messages), 모양만 여기서 가른다.
 */
export type PlaceholderPart = { key: boolean; text: string };

export function placeholderParts(text: string): Array<PlaceholderPart> {
	return text
		.split(/(`[^`]+`)/)
		.filter(Boolean)
		.map((part) =>
			part.startsWith("`") && part.endsWith("`") && part.length > 2
				? { key: true, text: part.slice(1, -1) }
				: { key: false, text: part },
		);
}

/** 화면 낭독기에 줄 글 — 백틱만 뺀다. */
export function placeholderText(text: string): string {
	return placeholderParts(text)
		.map((part) => part.text)
		.join("");
}
