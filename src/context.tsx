import { createContext, useContext } from "react";
import type { PendingMedia } from "./media/pending-media.ts";
import { DEFAULT_LIMITS, type MediaLimits } from "./media/validate.ts";
import { ko } from "./messages/ko.ts";
import type { EditorMessages } from "./messages/types.ts";

/**
 * 에디터 안의 부품(노드 · 도구 줄 · 메뉴)이 함께 보는 값.
 *
 * <Editor> 가 한 번 채워 두면 어디서든 꺼내 쓴다. 노드의 decorate() 도 같은
 * React 트리 안에서 그려지므로 여기 닿는다.
 */
/** 주소 한 줄을 묻는 작은 창. 링크와 유튜브가 쓴다. */
export type UrlRequest = {
	kind: "link" | "embed";
	/** 창을 붙일 자리. 없으면 커서 근처. */
	anchor: DOMRect | null;
};

export type EditorEnv = {
	messages: EditorMessages;
	limits: MediaLimits;
	/** 저장 전까지 사진·영상을 맡아 두는 곳. 읽기 전용이면 없다. */
	media: PendingMedia | null;
	/** 사람에게 알릴 문장 (형식이 틀린 파일 등). 앱이 띄운다. */
	notify: (message: string) => void;
	/** 주소를 묻는다. 취소하면 null. */
	askUrl: (request: UrlRequest) => Promise<string | null>;
};

const FALLBACK: EditorEnv = {
	messages: ko,
	limits: DEFAULT_LIMITS,
	media: null,
	notify: () => {},
	askUrl: async () => null,
};

export const EditorEnvContext = createContext<EditorEnv>(FALLBACK);

export function useEditorEnv(): EditorEnv {
	return useContext(EditorEnvContext);
}

export function useMessages(): EditorMessages {
	return useContext(EditorEnvContext).messages;
}
