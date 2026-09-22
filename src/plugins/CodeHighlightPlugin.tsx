import {
	PrismTokenizer,
	registerCodeHighlighting,
	type Tokenizer,
} from "@lexical/code-prism";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
/*
 * @lexical/code-prism 이 싣는 문법에는 없지만 우리 글에 자주 나오는 것들.
 * Prism 전역에 붙으므로 위 import 뒤에 와야 한다 (code-languages.ts 의 목록과 짝).
 */
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-dart.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-kotlin.js";
import "prismjs/components/prism-yaml.js";
import { useEffect } from "react";

/**
 * 언어를 고르기 전에는 색을 입히지 않는다.
 *
 * Prism 의 기본 언어는 JavaScript 다. 그래서 주소 한 줄을 붙여 넣어도 `//` 뒤가
 * 통째로 주석(회색)이 되어 배경과 구별되지 않았다. 글에 붙는 건 JS 보다 주소 ·
 * JSON · 로그가 많으니, 고르지 않은 코드블록은 본문 색 그대로 둔다.
 */
export const PLAIN_FIRST_TOKENIZER: Tokenizer = {
	...PrismTokenizer,
	defaultLanguage: null,
};

/** Prism 기반 코드블록 하이라이팅. 토큰 색은 styles.css 의 .editor-token-* 가 담당. */
export function CodeHighlightPlugin() {
	const [editor] = useLexicalComposerContext();

	useEffect(
		() => registerCodeHighlighting(editor, PLAIN_FIRST_TOKENIZER),
		[editor],
	);

	return null;
}
