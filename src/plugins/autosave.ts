import type { LexicalEditor } from "lexical";
import { SKIP_AUTOSAVE_TAG } from "../media/media-upload.ts";

/**
 * 자동저장 예약.
 *
 * 본문이 바뀔 때마다 타이머를 다시 건다. 마지막 편집에서 delayMs 만큼 조용하면
 * 그때 한 번 저장한다.
 *
 * 한글 조합 중에는 미룬다. `안녕하세요` 를 치면 조합 이벤트가 수십 번 나는데
 * 그때마다 저장하면 요청이 쏟아지고 되돌리기 이력도 지저분해진다. 조합이
 * 끝나고 다시 조용해진 뒤에 한 번 저장한다.
 *
 * React 를 모른다 — 플러그인은 이걸 useEffect 로 감싸기만 한다.
 */
export function registerAutoSave(
	editor: LexicalEditor,
	{
		onSave,
		delayMs = 1500,
		isComposing = () => false,
	}: {
		onSave: (editor: LexicalEditor) => void;
		delayMs?: number;
		isComposing?: () => boolean;
	},
): () => void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let disposed = false;

	const arm = () => {
		if (disposed) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(fire, delayMs);
	};

	const fire = () => {
		timer = null;
		if (disposed) return;
		// 조합이 아직 안 끝났으면 한 박자 더 기다린다.
		if (isComposing()) {
			arm();
			return;
		}
		onSave(editor);
	};

	const unregister = editor.registerUpdateListener(
		({ dirtyElements, dirtyLeaves, tags }) => {
			// 선택 영역만 움직인 것은 편집이 아니다.
			if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
			/*
			 * 저장이 스스로 건 편집은 사람이 친 게 아니다. 이걸 세면 올리는
			 * 동안 저장이 계속 새로 뜬다. 처음 본문을 실어 넣는 것도 같다 —
			 * 글을 열자마자 아무것도 안 고쳤는데 저장이 도는 건 이상하다.
			 */
			if (tags.has(SKIP_AUTOSAVE_TAG) || tags.has("history-merge")) return;
			arm();
		},
	);

	return () => {
		disposed = true;
		if (timer) clearTimeout(timer);
		unregister();
	};
}
