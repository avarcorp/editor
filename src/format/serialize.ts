import { $generateHtmlFromNodes } from "@lexical/html";
import { $getRoot, type LexicalEditor } from "lexical";

export type EditorContent = {
	/** Lexical editorState — 다시 편집할 때 복원하는 원본 */
	json: string;
	/** 읽기 화면·RSS 용으로 미리 렌더한 HTML */
	html: string;
	/** 검색·요약·읽는 시간 계산용 순수 텍스트 */
	plainText: string;
};

/**
 * 저장 시점에 세 가지 표현을 한 번에 뽑는다.
 * HTML 을 서버에서 다시 만들지 않는 이유: 워커에 DOM 이 없어서 headless
 * Lexical 로 렌더하려면 별도 폴리필이 필요하다. 브라우저가 이미 갖고 있는 걸 쓴다.
 */
export function readEditorContent(editor: LexicalEditor): EditorContent {
	const state = editor.getEditorState();

	const { html, plainText } = state.read(() => ({
		html: $generateHtmlFromNodes(editor, null),
		plainText: $getRoot().getTextContent(),
	}));

	return { json: JSON.stringify(state.toJSON()), html, plainText };
}
