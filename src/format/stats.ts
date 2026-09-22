export type EditorStats = { chars: number; minutes: number };

/**
 * 글자 수와 읽는 시간. 쓰는 동안 화면 구석에 띄우는 값이다.
 *
 * 한글은 분당 500자, 영문은 분당 200단어로 본다. 영문 기준(wpm)을 한글에 그대로
 * 쓰면 같은 글이 두세 배 길게 나온다. 글자 수는 공백을 뺀다.
 */
export function measureText(text: string): EditorStats {
	const hangul = (text.match(/[가-힣]/g) ?? []).length;
	const latinWords = (text.match(/[A-Za-z0-9]+/g) ?? []).length;
	return {
		chars: text.replace(/\s/g, "").length,
		minutes: Math.max(1, Math.round(hangul / 500 + latinWords / 200)),
	};
}
