import {
	$getNodeByKey,
	$getRoot,
	$isElementNode,
	type LexicalEditor,
	type LexicalNode,
} from "lexical";
import { ko } from "../messages/ko.ts";
import type { EditorMessages } from "../messages/types.ts";
import { $isImageNode } from "../nodes/ImageNode.tsx";
import { $isImageRowNode } from "../nodes/ImageRowNode.tsx";
import { $isVideoNode } from "../nodes/VideoNode.tsx";
import {
	isPreviewSrc,
	MissingFileError,
	type PendingMedia,
	UploadError,
} from "./pending-media.ts";

type MediaNode = { key: string; src: string; video: boolean };

/**
 * 저장이 스스로 거는 편집에 붙이는 표시.
 *
 * 자동저장(autosave.ts)이 이걸 보고 "사람이 친 게 아니다"로 판단해 타이머를
 * 다시 걸지 않는다. 안 그러면 6초짜리 영상 하나를 올리는 동안 1.5초마다
 * 저장이 새로 뜨고, 새 글이면 id 가 아직 없어서 그때마다 초안이 새로 생긴다.
 */
export const SKIP_AUTOSAVE_TAG = "media-upload";

/**
 * 되돌리기 기록에 따로 남기지 않는다는 표시.
 *
 * src 교체가 한 단계로 남으면 Cmd+Z 한 번에 이미 놓아준 blob: 주소로
 * 되돌아간다. 진행률은 100번 갱신되므로 더 말할 것도 없다.
 */
const MEDIA_UPDATE_TAG = [SKIP_AUTOSAVE_TAG, "history-merge"];

/*
 * 맨 위 자식만 보면 안 된다. 표를 붙여넣으면 칸 안이 shadow root 라
 * $insertNodeToNearestRoot 가 그림을 칸 안에 넣는다. 거기 있는 그림을 놓치면
 * blob: 주소가 그대로 저장돼 독자에게 깨진 그림이 나간다 — 오류도 안 뜬다.
 */
function collect(node: LexicalNode, out: Array<MediaNode>) {
	if ($isImageNode(node)) {
		out.push({ key: node.getKey(), src: node.getSrc(), video: false });
		return;
	}
	if ($isVideoNode(node)) {
		out.push({ key: node.getKey(), src: node.getSrc(), video: true });
		return;
	}
	/*
	 * 나란히 놓은 사진은 노드 하나에 여러 장이 들어 있다. 한 장씩 따로 센다 —
	 * 노드 단위로 보면 줄 안의 blob: 을 놓쳐서 깨진 그림이 그대로 저장된다.
	 */
	if ($isImageRowNode(node)) {
		for (const image of node.getImages()) {
			out.push({ key: node.getKey(), src: image.src, video: false });
		}
		return;
	}
	if ($isElementNode(node)) {
		for (const child of node.getChildren()) collect(child, out);
	}
}

function readMediaNodes(editor: LexicalEditor): Array<MediaNode> {
	return editor.getEditorState().read(() => {
		const out: Array<MediaNode> = [];
		collect($getRoot(), out);
		return out;
	});
}

/**
 * 본문에 들어 있는 사진 · 영상 주소 전부. 줄 안의 사진도 한 장씩 센다.
 * 앱이 "이 글에 이미 넣은 것" 을 표시할 때 쓴다.
 */
export function listMediaSrcs(editor: LexicalEditor): Set<string> {
	return new Set(readMediaNodes(editor).map((node) => node.src));
}

/**
 * 본문에 남아 있는 미리보기 주소. 순서는 본문 순서, 중복은 하나로 친다.
 *
 * 본문을 기준으로 삼는 게 핵심이다 — 붙였다가 지운 그림은 여기 안 잡히므로
 * 올라가지 않고, CDN 에 주인 없는 파일도 안 남는다.
 */
export function findPreviewSrcs(editor: LexicalEditor): Array<string> {
	const seen = new Set<string>();
	for (const node of readMediaNodes(editor)) {
		if (isPreviewSrc(node.src)) seen.add(node.src);
	}
	return [...seen];
}

/**
 * 미리보기 주소 하나를 쓰는 노드 전부의 src 를 바꿔 끼운다.
 *
 * history-merge 로 앞 단계에 합친다. 따로 한 단계로 남기면 Cmd+Z 한 번에
 * 이미 놓아준 blob: 주소로 되돌아가고, 그 뒤로는 저장이 통째로 막힌다.
 */
function swapSrc(editor: LexicalEditor, previewUrl: string, url: string) {
	editor.update(
		() => {
			for (const found of readMediaNodes(editor)) {
				if (found.src !== previewUrl) continue;
				const node = $getNodeByKey(found.key);
				if ($isImageNode(node) || $isVideoNode(node)) node.setUploaded(url);
				// 줄은 그 자리의 사진만 바꾼다. 나머지 사진과 순서는 그대로다.
				else if ($isImageRowNode(node)) node.setImageSrc(previewUrl, url);
			}
		},
		{ discrete: true, tag: MEDIA_UPDATE_TAG },
	);
}

function markUploading(
	editor: LexicalEditor,
	previewUrl: string,
	uploading: boolean,
) {
	editor.update(
		() => {
			for (const found of readMediaNodes(editor)) {
				if (found.src !== previewUrl) continue;
				const node = $getNodeByKey(found.key);
				if ($isImageNode(node) || $isVideoNode(node))
					node.setUploading(uploading);
				else if ($isImageRowNode(node))
					node.setImageUploading(previewUrl, uploading);
			}
		},
		{ discrete: true, tag: MEDIA_UPDATE_TAG },
	);
}

function setProgress(
	editor: LexicalEditor,
	previewUrl: string,
	percent: number,
) {
	editor.update(
		() => {
			for (const found of readMediaNodes(editor)) {
				if (found.src !== previewUrl || !found.video) continue;
				const node = $getNodeByKey(found.key);
				if ($isVideoNode(node)) node.setProgress(percent);
			}
		},
		{ discrete: true, tag: MEDIA_UPDATE_TAG },
	);
}

/**
 * 저장 직전에 도는 단계. 파일 업로드 → 주소 받기 → 본문의 src 교체.
 *
 * 이걸 통과해야 본문을 직렬화한다. 하나라도 못 올리면 던져서 저장을 막는다 —
 * blob: 주소가 그대로 저장되면 글쓴이 화면에서만 멀쩡하고 독자에게는 깨진
 * 그림이 나간다. 실패해도 미리보기는 본문에 그대로 두므로 다시 저장을 누르면
 * 재시도한다.
 */
export async function uploadPendingMedia(
	editor: LexicalEditor,
	store: PendingMedia,
	messages: EditorMessages = ko,
): Promise<{ dropped: number }> {
	if (findPreviewSrcs(editor).length === 0) return { dropped: 0 };

	let dropped = 0;
	// 도는 동안 화면을 떠도 대기실이 비워지지 않게 잡아 둔다.
	store.beginSave();
	try {
		/*
		 * 한 번 훑고 끝내지 않는다. 올리는 동안 사람이 사진을 또 붙이면 그 사진은
		 * 처음 훑은 목록에 없어서, 여기서 끝내면 blob: 째로 저장된다. 남은 게
		 * 없을 때까지 다시 훑는다 — 마지막 확인과 호출한 쪽의 직렬화 사이에는
		 * await 가 없어서, 그 틈에 끼어들 입력은 없다.
		 *
		 * 몇 바퀴에서 끊는 건 무한히 돌지 않게 하려는 안전줄이다. 사람이 그만큼
		 * 연달아 붙이면 남은 것은 다음 저장이 올린다.
		 */
		for (let round = 0; round < MAX_ROUNDS; round++) {
			const pending = findPreviewSrcs(editor);
			if (pending.length === 0) break;

			/*
			 * 되살릴 수 없는 미리보기는 뺀다. 새로고침하면 대기실이 비고 blob: 은
			 * 죽는다 — 화면에서도 이미 깨져 있다. 붙잡고 있으면 저장이 영영
			 * 막혀서 그 뒤로 쓰는 글이 하나도 안 남는다.
			 */
			const dead = pending.filter((src) => !store.knows(src));
			if (dead.length > 0) {
				removePreviews(editor, new Set(dead));
				dropped += dead.length;
			}

			for (const previewUrl of pending) {
				if (!store.knows(previewUrl)) continue;
				markUploading(editor, previewUrl, true);
				try {
					const url = await store.resolve(previewUrl, (percent) =>
						setProgress(editor, previewUrl, percent),
					);
					swapSrc(editor, previewUrl, url);
					store.forget(previewUrl);
				} catch (error) {
					markUploading(editor, previewUrl, false);
					throw new UploadError(
						error instanceof UploadError
							? error.message
							: error instanceof MissingFileError
								? messages.media.missingFile
								: messages.media.uploadFailed,
					);
				}
			}
		}
	} finally {
		store.endSave();
	}
	return { dropped };
}

const MAX_ROUNDS = 5;

/** 이 미리보기 주소를 쓰는 사진을 본문에서 뺀다. 줄 안이면 그 사진만. */
function removePreviews(editor: LexicalEditor, srcs: Set<string>) {
	editor.update(
		() => {
			const seen = new Set<string>();
			for (const found of readMediaNodes(editor)) {
				if (!srcs.has(found.src) || seen.has(found.key)) continue;
				seen.add(found.key);
				const node = $getNodeByKey(found.key);
				if ($isImageRowNode(node)) node.removeImagesBySrc(srcs);
				else node?.remove();
			}
		},
		{ discrete: true, tag: MEDIA_UPDATE_TAG },
	);
}
