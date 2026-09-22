import type { LexicalEditor } from "lexical";
import { ko } from "./ko.ts";
import type { EditorMessages } from "./types.ts";

/*
 * exportDOM 은 React 밖에서 불린다 (저장할 때 HTML 을 뽑는 자리). 거기서도
 * 같은 언어로 쓰려고 에디터마다 문구를 걸어 둔다. 안 걸었으면 한국어.
 */
const byEditor = new WeakMap<LexicalEditor, EditorMessages>();

export function bindMessages(
	editor: LexicalEditor,
	messages: EditorMessages,
): void {
	byEditor.set(editor, messages);
}

export function messagesOf(editor: LexicalEditor): EditorMessages {
	return byEditor.get(editor) ?? ko;
}
