import { $getRoot, $getSelection, type LexicalNode } from "lexical";
import { $createImageNode } from "../nodes/ImageNode.tsx";
import { $createImageRowNode, type RowImage } from "../nodes/ImageRowNode.tsx";
import { $insertBlock } from "../nodes/insert-block.ts";
import { $createVideoNode } from "../nodes/VideoNode.tsx";
import { chunkIntoRows } from "./image-row.ts";

/**
 * 이미 어딘가에 올라가 있는 사진 · 영상. 앱의 미디어 보관함(스토리지 등)에서
 * 꺼내 넣을 때 쓴다 — 파일이 아니라 주소라서 올릴 것이 없다.
 */
export type MediaRef = {
	kind: "image" | "video";
	src: string;
	/** 사진의 대체 문구. 없으면 비운다. */
	alt?: string;
	/** 원본 크기. 사진 나란히에서 폭을 나누는 데 쓴다 (image-row.ts). */
	width?: number;
	height?: number;
};

/** sequence: 하나씩 차례로 · row: 사진을 한 줄에 나란히 */
export type MediaLayout = "sequence" | "row";

/** 나란히 넣을 수 있나. 사진만 두 장 이상이어야 한다 — 영상은 줄에 못 들어간다. */
export function canLayoutAsRow(items: Array<MediaRef>): boolean {
	return items.length >= 2 && items.every((item) => item.kind === "image");
}

function toRowImage(item: MediaRef): RowImage {
	return {
		src: item.src,
		altText: item.alt ?? "",
		width: item.width ?? 0,
		height: item.height ?? 0,
	};
}

function $nodeFor(item: MediaRef): LexicalNode {
	return item.kind === "video"
		? $createVideoNode({ src: item.src })
		: $createImageNode({ src: item.src, altText: item.alt ?? "" });
}

/**
 * 넣을 블록들. 나란히면 사진 파일을 넣을 때(MediaPlugin)와 같은 규칙으로 묶는다 —
 * 한 줄에 셋까지, 넘치면 줄 수를 먼저 정해 고르게, 한 장 남은 줄은 그냥 사진.
 * 나란히가 안 되는 묶음(영상이 섞임 · 한 장)은 하나씩 넣는다.
 */
export function $createMediaNodes(
	items: Array<MediaRef>,
	layout: MediaLayout,
): Array<LexicalNode> {
	if (layout === "row" && canLayoutAsRow(items)) {
		return chunkIntoRows(items).map((row) =>
			row.length === 1
				? $nodeFor(row[0])
				: $createImageRowNode({ images: row.map(toRowImage) }),
		);
	}
	return items.map($nodeFor);
}

/**
 * 미디어를 본문에 넣는다. editor.update 안에서 부른다.
 *
 * - at 없음: 커서 자리. 빈 줄이면 그 줄 자리에 들어간다 ($insertBlock).
 *   커서가 없으면(본문을 아직 누르지 않았으면) 글 끝에 붙인다.
 * - at: 맨 위 블록 중 몇 번째 앞에 넣을지. 끌어다 놓을 때 (drop-target.ts).
 */
export function $insertMedia(
	items: Array<MediaRef>,
	layout: MediaLayout,
	at?: number,
): void {
	const nodes = $createMediaNodes(items, layout);
	if (nodes.length === 0) return;

	const root = $getRoot();
	if (at !== undefined) {
		const target = root.getChildren()[at];
		if (target) for (const node of nodes) target.insertBefore(node);
		else root.append(...nodes);
		return;
	}

	if (!$getSelection()) {
		root.append(...nodes);
		return;
	}
	for (const node of nodes) $insertBlock(node);
}
