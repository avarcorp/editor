import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useState } from "react";

/**
 * 한글/일본어/중국어 IME 조합 중인지 알려준다.
 *
 * 왜 필요한가: 한글은 `ㅎ → 하 → 한` 처럼 한 글자를 만드는 동안 keydown/input 이
 * 여러 번 발생한다. 이걸 그대로 흘려보내면
 *   - 자동저장이 글자당 한 번씩 돌고,
 *   - 플로팅 툴바가 조합 때마다 위치를 다시 잡아 깜빡이고,
 *   - Enter 로 조합을 확정하는 순간 문단이 하나 더 생기기도 한다.
 * 조합이 끝나는 compositionend 이후에만 반응하도록 이 값을 게이트로 쓴다.
 */
export function useIsComposing(): boolean {
	const [editor] = useLexicalComposerContext();
	const [isComposing, setIsComposing] = useState(false);

	useEffect(() => {
		// registerRootListener 는 contentEditable 이 교체될 때도 다시 불려서,
		// 이전 엘리먼트에 리스너가 남는 일이 없다.
		return editor.registerRootListener((rootElement, prevRootElement) => {
			const start = () => setIsComposing(true);
			const end = () => setIsComposing(false);

			prevRootElement?.removeEventListener("compositionstart", start);
			prevRootElement?.removeEventListener("compositionend", end);

			rootElement?.addEventListener("compositionstart", start);
			rootElement?.addEventListener("compositionend", end);
		});
	}, [editor]);

	return isComposing;
}
