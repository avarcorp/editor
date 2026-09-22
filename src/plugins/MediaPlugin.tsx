import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { eventFiles, mergeRegister } from "@lexical/utils";
import {
	$getNodeByKey,
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_HIGH,
	COMMAND_PRIORITY_LOW,
	createCommand,
	DRAGOVER_COMMAND,
	DROP_COMMAND,
	type LexicalCommand,
	type LexicalNode,
	type NodeKey,
	PASTE_COMMAND,
} from "lexical";
import { useCallback, useEffect } from "react";
import { useEditorEnv } from "../context.tsx";
import { type Embed, parseEmbed } from "../media/embed.ts";
import { chunkIntoRows, MAX_ROW } from "../media/image-row.ts";
import type { MediaKind } from "../media/pending-media.ts";
import { validateMedia } from "../media/validate.ts";
import { $createEmbedNode } from "../nodes/EmbedNode.tsx";
import { $createImageNode } from "../nodes/ImageNode.tsx";
import {
	$createImageRowNode,
	$isImageRowNode,
	APPEND_TO_IMAGE_ROW_COMMAND,
	type RowImage,
} from "../nodes/ImageRowNode.tsx";
import { $insertBlock } from "../nodes/insert-block.ts";
import { $createVideoNode } from "../nodes/VideoNode.tsx";

export const INSERT_IMAGE_FILE_COMMAND: LexicalCommand<File> = createCommand(
	"INSERT_IMAGE_FILE_COMMAND",
);
export const INSERT_VIDEO_FILE_COMMAND: LexicalCommand<File> = createCommand(
	"INSERT_VIDEO_FILE_COMMAND",
);
export const INSERT_EMBED_COMMAND: LexicalCommand<Embed> = createCommand(
	"INSERT_EMBED_COMMAND",
);
/** 사진 여러 장을 나란히. 두 장 이상이면 줄로 묶는다 (lib/image-row.ts). */
export const INSERT_IMAGE_ROW_COMMAND: LexicalCommand<Array<File>> =
	createCommand("INSERT_IMAGE_ROW_COMMAND");

/**
 * 사진의 원본 크기.
 *
 * 줄 안에서 폭을 나누려면 가로세로비가 있어야 한다. 이 브라우저에 있는 파일이라
 * 몇 ms 면 읽힌다. 못 읽으면 0 — 줄은 정사각형으로 보고 나눈다.
 */
function readImageSize(
	url: string,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const image = new Image();
		image.onload = () =>
			resolve({ width: image.naturalWidth, height: image.naturalHeight });
		image.onerror = () => resolve({ width: 0, height: 0 });
		image.src = url;
	});
}

function requireMedia<T>(media: T | null): T {
	if (!media) throw new Error("MediaPlugin needs <Editor media={…}>.");
	return media;
}

/**
 * 그림·영상 삽입.
 *
 * 붙이는 순간에는 올리지 않는다. blob: 미리보기를 본문에 넣고 파일은 store 에
 * 맡겨 둔다. 실제 업로드는 저장할 때 editor/media-upload.ts 가 한 번에 한다 —
 * 붙였다가 지운 파일이 CDN 에 주인 없이 남지 않게 하려는 것이다.
 */
export function MediaPlugin() {
	const [editor] = useLexicalComposerContext();
	const { media, limits, messages, notify } = useEditorEnv();
	const store = requireMedia(media);

	/** 문제가 있으면 알리고 false. */
	const accept = useCallback(
		(file: File, kind: MediaKind) => {
			const problem = validateMedia(file, kind, limits, messages);
			if (problem) notify(problem);
			return problem === null;
		},
		[limits, messages, notify],
	);

	const insertImage = useCallback(
		(file: File) => {
			if (!accept(file, "image")) return;

			const previewUrl = URL.createObjectURL(file);
			store.add(previewUrl, file, "image");

			editor.update(() => {
				$insertBlock($createImageNode({ src: previewUrl, altText: file.name }));
			});
		},
		[editor, accept, store],
	);

	const insertVideo = useCallback(
		(file: File) => {
			if (!accept(file, "video")) return;

			const previewUrl = URL.createObjectURL(file);
			store.add(previewUrl, file, "video");

			editor.update(() => {
				$insertBlock($createVideoNode({ src: previewUrl }));
			});
		},
		[editor, accept, store],
	);

	/**
	 * 사진 여러 장을 미리보기로 만든다. 올리지는 않는다 — 대기실에 맡기고
	 * 저장할 때 한 번에 올린다. 형식이 틀린 파일은 알리고 건너뛴다.
	 */
	const prepareImages = useCallback(
		async (files: Array<File>): Promise<Array<RowImage>> => {
			const accepted: Array<File> = [];
			for (const file of files) {
				if (accept(file, "image")) accepted.push(file);
			}
			return Promise.all(
				accepted.map(async (file) => {
					const src = URL.createObjectURL(file);
					store.add(src, file, "image");
					const size = await readImageSize(src);
					return { src, altText: file.name, ...size };
				}),
			);
		},
		[accept, store],
	);

	/**
	 * 사진 여러 장을 나란히 넣는다. 한 줄에 셋까지라 넘치면 고르게 나눈다.
	 * 한 장만 남으면 줄로 묶지 않는다.
	 */
	const insertImageRow = useCallback(
		async (files: Array<File>) => {
			const images = await prepareImages(files);
			if (images.length === 0) return;

			editor.update(() => {
				for (const row of chunkIntoRows(images)) {
					$insertBlock(
						row.length === 1
							? $createImageNode({ src: row[0].src, altText: row[0].altText })
							: $createImageRowNode({ images: row }),
					);
				}
			});
		},
		[editor, prepareImages],
	);

	/**
	 * 이미 있는 줄에 사진을 더 넣는다. 자리가 모자라면 남는 사진은 바로 아래
	 * 새 줄로 넘긴다 — 고른 사진을 말없이 버리지 않는다.
	 */
	const appendToRow = useCallback(
		async (key: NodeKey, files: Array<File>) => {
			const images = await prepareImages(files);
			if (images.length === 0) return;

			editor.update(() => {
				const row = $getNodeByKey(key);
				if (!$isImageRowNode(row)) return;

				const current = row.getImages();
				const room = Math.max(0, MAX_ROW - current.length);
				row.setImages([...current, ...images.slice(0, room)]);

				let anchor: LexicalNode = row;
				for (const rest of chunkIntoRows(images.slice(room))) {
					const node =
						rest.length === 1
							? $createImageNode({ src: rest[0].src, altText: rest[0].altText })
							: $createImageRowNode({ images: rest });
					anchor.insertAfter(node);
					anchor = node;
				}
			});
		},
		[editor, prepareImages],
	);

	/**
	 * 파일 여러 개가 한 번에 들어오면 종류별로 나눈다.
	 *
	 * 사진이 두 장 이상이면 나란히 묶는다. 한꺼번에 떨어뜨렸다는 건 한 묶음으로
	 * 보겠다는 뜻에 가깝고, 따로 세우고 싶으면 줄에서 "따로 놓기" 한 번이면 된다.
	 * 영상은 늘 한 편씩이다.
	 */
	const insertFiles = useCallback(
		(files: Array<File>) => {
			const images = files.filter((file) => file.type.startsWith("image/"));
			const videos = files.filter((file) => file.type.startsWith("video/"));

			if (images.length === 1) insertImage(images[0]);
			else if (images.length > 1) void insertImageRow(images);
			for (const video of videos) insertVideo(video);

			return images.length + videos.length > 0;
		},
		[insertImage, insertImageRow, insertVideo],
	);

	useEffect(() => {
		return mergeRegister(
			editor.registerCommand(
				INSERT_IMAGE_FILE_COMMAND,
				(file) => {
					insertImage(file);
					return true;
				},
				COMMAND_PRIORITY_LOW,
			),

			editor.registerCommand(
				INSERT_VIDEO_FILE_COMMAND,
				(file) => {
					insertVideo(file);
					return true;
				},
				COMMAND_PRIORITY_LOW,
			),

			editor.registerCommand(
				INSERT_IMAGE_ROW_COMMAND,
				(files) => {
					void insertImageRow(files);
					return true;
				},
				COMMAND_PRIORITY_LOW,
			),

			editor.registerCommand(
				APPEND_TO_IMAGE_ROW_COMMAND,
				({ key, files }) => {
					void appendToRow(key, files);
					return true;
				},
				COMMAND_PRIORITY_LOW,
			),

			editor.registerCommand(
				INSERT_EMBED_COMMAND,
				(embed) => {
					editor.update(() => {
						$insertBlock($createEmbedNode(embed));
					});
					return true;
				},
				COMMAND_PRIORITY_LOW,
			),

			/*
			 * 붙여넣기. 파일이면 올리고, 빈 줄에 영상 주소만 붙였으면 임베드로
			 * 바꾼다. 글 중간에 링크로 넣으려던 것까지 카드로 만들면 곤란해서
			 * 줄이 비어 있을 때만 가로챈다.
			 */
			editor.registerCommand(
				PASTE_COMMAND,
				(event) => {
					const [, files] = eventFiles(event);
					if (files.length > 0 && insertFiles(files)) {
						event.preventDefault();
						return true;
					}

					// PASTE_COMMAND 는 붙여넣기 단축키(KeyboardEvent)로도 온다.
					const clipboard =
						event instanceof ClipboardEvent ? event.clipboardData : null;
					const text = clipboard?.getData("text/plain")?.trim();
					if (!text || /\s/.test(text)) return false;
					const embed = parseEmbed(text);
					if (!embed) return false;

					let onEmptyLine = false;
					editor.getEditorState().read(() => {
						const selection = $getSelection();
						if (!$isRangeSelection(selection) || !selection.isCollapsed())
							return;
						onEmptyLine =
							selection.anchor.getNode().getTextContent().trim() === "";
					});
					if (!onEmptyLine) return false;

					event.preventDefault();
					editor.update(() => {
						$insertBlock($createEmbedNode(embed));
					});
					return true;
				},
				COMMAND_PRIORITY_HIGH,
			),

			editor.registerCommand(
				DRAGOVER_COMMAND,
				(event) => {
					if (!event.dataTransfer) return false;
					const hasFiles = Array.from(event.dataTransfer.items).some(
						(item) => item.kind === "file",
					);
					if (!hasFiles) return false;
					event.preventDefault();
					return true;
				},
				COMMAND_PRIORITY_LOW,
			),

			editor.registerCommand(
				DROP_COMMAND,
				(event) => {
					const [, files] = eventFiles(event);
					if (!insertFiles(files)) return false;
					event.preventDefault();
					return true;
				},
				COMMAND_PRIORITY_HIGH,
			),
		);
	}, [
		editor,
		insertImage,
		insertVideo,
		insertFiles,
		insertImageRow,
		appendToRow,
	]);

	return null;
}
