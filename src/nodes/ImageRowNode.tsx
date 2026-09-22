import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
	$applyNodeReplacement,
	$getNodeByKey,
	CLICK_COMMAND,
	COMMAND_PRIORITY_LOW,
	createCommand,
	DecoratorNode,
	type DOMExportOutput,
	type EditorConfig,
	KEY_BACKSPACE_COMMAND,
	KEY_DELETE_COMMAND,
	type LexicalCommand,
	type LexicalEditor,
	type LexicalNode,
	type LexicalUpdateJSON,
	mergeRegister,
	type NodeKey,
	type SerializedLexicalNode,
	type Spread,
} from "lexical";
import { type JSX, useEffect, useRef } from "react";
import { useMessages } from "../context.tsx";
import { flexGrow, MAX_ROW, moveItem, removeItem } from "../media/image-row.ts";
import { Icon } from "../ui/icons.tsx";
import { $createImageNode } from "./ImageNode.tsx";
import { MediaCaption } from "./MediaCaption.tsx";

export type RowImage = {
	src: string;
	altText: string;
	/** 원본 크기. 한 줄 안에서 폭을 나누는 데 쓴다 (lib/image-row.ts) */
	width: number;
	height: number;
};

export type SerializedImageRowNode = Spread<
	{ images: Array<RowImage>; caption: string },
	SerializedLexicalNode
>;

/**
 * 줄에 사진을 더 넣어 달라는 요청. 파일을 고르고 올릴 준비를 하는 건
 * MediaPlugin 몫이라(대기실을 거기서 들고 있다) 명령으로 넘긴다.
 */
export const APPEND_TO_IMAGE_ROW_COMMAND: LexicalCommand<{
	key: NodeKey;
	files: Array<File>;
}> = createCommand("APPEND_TO_IMAGE_ROW_COMMAND");

function ImageRowComponent({
	nodeKey,
	images,
	caption,
	uploading,
}: {
	nodeKey: NodeKey;
	images: Array<RowImage>;
	caption: string;
	uploading: Array<string>;
}) {
	const [editor] = useLexicalComposerContext();
	const messages = useMessages();
	const [isSelected, setSelected, clearSelection] =
		useLexicalNodeSelection(nodeKey);
	const trackRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const $onDelete = () => {
			if (!isSelected) return false;
			editor.update(() => {
				$getNodeByKey(nodeKey)?.remove();
			});
			return true;
		};

		return mergeRegister(
			editor.registerCommand(
				CLICK_COMMAND,
				(event: MouseEvent) => {
					const track = trackRef.current;
					if (!track || !(event.target instanceof Node)) return false;
					if (!track.contains(event.target)) return false;
					// 사진 위의 단추는 단추대로 눌리게 둔다
					if ((event.target as Element).closest("button")) return false;
					if (!event.shiftKey) clearSelection();
					setSelected(!isSelected);
					return true;
				},
				COMMAND_PRIORITY_LOW,
			),
			editor.registerCommand(
				KEY_DELETE_COMMAND,
				$onDelete,
				COMMAND_PRIORITY_LOW,
			),
			editor.registerCommand(
				KEY_BACKSPACE_COMMAND,
				$onDelete,
				COMMAND_PRIORITY_LOW,
			),
		);
	}, [clearSelection, editor, isSelected, nodeKey, setSelected]);

	const withNode = (fn: (node: ImageRowNode) => void) =>
		editor.update(() => {
			const node = $getNodeByKey(nodeKey);
			if ($isImageRowNode(node)) fn(node);
		});

	const pickMore = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.multiple = true;
		input.onchange = () => {
			const files = Array.from(input.files ?? []);
			if (files.length > 0) {
				editor.dispatchCommand(APPEND_TO_IMAGE_ROW_COMMAND, {
					key: nodeKey,
					files,
				});
			}
		};
		input.click();
	};

	/*
	 * 열쇠는 자리 번호가 아니라 주소로 짓는다. 순서를 바꾸는 줄이라, 번호로
	 * 지으면 사진이 자리를 바꿀 때 React 가 엉뚱한 <img> 를 이어 쓴다. 같은
	 * 사진을 두 번 넣은 드문 경우만 몇 번째인지 덧붙인다.
	 */
	const seen = new Map<string, number>();
	const keys = images.map((image) => {
		const nth = seen.get(image.src) ?? 0;
		seen.set(image.src, nth + 1);
		return nth === 0 ? image.src : `${image.src}#${nth}`;
	});

	return (
		<figure
			className="editor-image-row"
			data-selected={isSelected}
			data-count={images.length}
		>
			<div ref={trackRef} className="editor-image-row-track">
				{images.map((image, index) => (
					<div
						key={keys[index]}
						className="editor-image-row-item"
						style={{ flex: `${flexGrow(image)} 1 0%` }}
						data-uploading={uploading.includes(image.src)}
					>
						<img
							src={image.src}
							alt={image.altText}
							width={image.width || undefined}
							height={image.height || undefined}
							draggable={false}
						/>
						{/* 사진 하나를 고치는 단추. 올려야 보인다 — 늘 떠 있으면 사진을 가린다 */}
						<div className="editor-image-row-tools">
							<button
								type="button"
								aria-label={messages.media.moveLeft}
								disabled={index === 0}
								onClick={() =>
									withNode((node) =>
										node.setImages(moveItem(node.getImages(), index, -1)),
									)
								}
							>
								<Icon name="chevronLeft" size={14} />
							</button>
							<button
								type="button"
								aria-label={messages.media.moveRight}
								disabled={index === images.length - 1}
								onClick={() =>
									withNode((node) =>
										node.setImages(moveItem(node.getImages(), index, 1)),
									)
								}
							>
								<Icon name="chevronRight" size={14} />
							</button>
							<button
								type="button"
								aria-label={messages.media.removeFromRow}
								onClick={() => withNode((node) => node.removeImageAt(index))}
							>
								<Icon name="x" size={14} />
							</button>
						</div>
					</div>
				))}
			</div>

			{/* 줄 전체를 고르면 줄 단위 도구가 뜬다 */}
			{isSelected ? (
				<div className="editor-image-row-bar">
					{images.length < MAX_ROW ? (
						<button type="button" onClick={pickMore}>
							<Icon name="imagePlus" size={14} />
							{messages.media.addToRow}
						</button>
					) : null}
					<button
						type="button"
						onClick={() => withNode((node) => node.unpack())}
					>
						<Icon name="rows" size={14} />
						{messages.media.unpackRow}
					</button>
				</div>
			) : null}

			<MediaCaption
				value={caption}
				placeholder={messages.media.captionPlaceholder}
				onChange={(next) => withNode((node) => node.setCaption(next))}
			/>
		</figure>
	);
}

/**
 * 사진 여러 장을 높이를 맞춰 한 줄에 놓는다.
 *
 * 사진마다 가로세로비만큼 폭을 나눠 가지면 높이가 저절로 같아진다. 그래서
 * 원본 크기를 함께 저장한다 — 없으면 정사각형으로 보고 나눈다.
 *
 * 설명은 줄 전체에 하나다. 사진마다 달면 작은 사진 밑에 글이 세 줄씩 쌓인다.
 */
export class ImageRowNode extends DecoratorNode<JSX.Element> {
	__images: Array<RowImage>;
	__caption: string;
	/** 저장하며 올리는 중인 사진의 src. 에디터 상태에는 저장하지 않는다. */
	__uploading: Array<string>;

	static getType(): string {
		return "image-row";
	}

	static clone(node: ImageRowNode): ImageRowNode {
		const clone = new ImageRowNode(
			{ images: node.__images, caption: node.__caption },
			node.__key,
		);
		clone.__uploading = node.__uploading;
		return clone;
	}

	constructor(
		payload: { images: Array<RowImage>; caption?: string },
		key?: NodeKey,
	) {
		super(key);
		this.__images = payload.images;
		this.__caption = payload.caption ?? "";
		this.__uploading = [];
	}

	static importJSON(serialized: SerializedImageRowNode): ImageRowNode {
		return $createImageRowNode({ images: [] }).updateFromJSON(serialized);
	}

	updateFromJSON(serialized: LexicalUpdateJSON<SerializedImageRowNode>): this {
		const self = super.updateFromJSON(serialized);
		self.__images = (serialized.images ?? []).map((image) => ({
			src: image.src,
			altText: image.altText ?? "",
			width: image.width ?? 0,
			height: image.height ?? 0,
		}));
		self.__caption = serialized.caption ?? "";
		self.__uploading = [];
		return self;
	}

	exportJSON(): SerializedImageRowNode {
		return {
			...super.exportJSON(),
			images: this.__images,
			caption: this.__caption,
		};
	}

	/**
	 * 독자 화면에 나가는 모양.
	 *
	 * 폭 몫은 인라인 flex 로 싣는다. 사진마다 값이 달라서 클래스로는 못 적는다.
	 * width/height 를 함께 적어 두면 사진을 받기 전에도 자리가 잡혀 글이 안 튄다.
	 */
	exportDOM(): DOMExportOutput {
		const figure = document.createElement("figure");
		figure.className = "image-row";
		figure.setAttribute("data-count", String(this.__images.length));

		const track = document.createElement("div");
		track.className = "image-row-track";
		for (const image of this.__images) {
			const img = document.createElement("img");
			img.setAttribute("src", image.src);
			img.setAttribute("alt", image.altText);
			img.setAttribute("loading", "lazy");
			if (image.width > 0 && image.height > 0) {
				img.setAttribute("width", String(image.width));
				img.setAttribute("height", String(image.height));
			}
			img.setAttribute("style", `flex: ${flexGrow(image)} 1 0%`);
			track.appendChild(img);
		}
		figure.appendChild(track);

		if (this.__caption) {
			const caption = document.createElement("figcaption");
			caption.textContent = this.__caption;
			figure.appendChild(caption);
		}
		return { element: figure };
	}

	/*
	 * 한 장짜리 사진의 테마 클래스(editor-image)를 빌려 쓰지 않는다. 그 클래스는
	 * 바깥 여백과 가운데 정렬, 사진 모서리까지 정해서, 줄 안쪽 figure 의 여백과
	 * 겹치고 사진 모서리를 덮어쓴다.
	 */
	createDOM(_config: EditorConfig): HTMLElement {
		return document.createElement("div");
	}

	updateDOM(): false {
		return false;
	}

	isInline(): false {
		return false;
	}

	getTextContent(): string {
		return (
			this.__caption ||
			this.__images
				.map((image) => image.altText)
				.filter(Boolean)
				.join(" ")
		);
	}

	getImages(): Array<RowImage> {
		return this.getLatest().__images;
	}

	setImages(images: Array<RowImage>): void {
		this.getWritable().__images = images;
	}

	setCaption(caption: string): void {
		this.getWritable().__caption = caption;
	}

	/** 저장하며 미리보기 주소를 공개 주소로 바꿔 끼운다 (editor/media-upload.ts). */
	setImageSrc(previewUrl: string, url: string): void {
		const writable = this.getWritable();
		writable.__images = writable.__images.map((image) =>
			image.src === previewUrl ? { ...image, src: url } : image,
		);
		writable.__uploading = writable.__uploading.filter(
			(src) => src !== previewUrl,
		);
	}

	setImageUploading(src: string, uploading: boolean): void {
		const writable = this.getWritable();
		const rest = writable.__uploading.filter((item) => item !== src);
		writable.__uploading = uploading ? [...rest, src] : rest;
	}

	/**
	 * 한 장을 뺀다. 한 장만 남으면 줄을 풀어 보통 사진으로 되돌린다 —
	 * 한 장짜리 줄은 폭만 이상하게 좁고 줄로서 할 일이 없다.
	 */
	removeImageAt(index: number): void {
		this.settle(removeItem(this.getImages(), index));
	}

	/** 이 주소들을 쓰는 사진을 한꺼번에 뺀다 (저장 중 되살릴 수 없는 미리보기). */
	removeImagesBySrc(srcs: Set<string>): void {
		this.settle(this.getImages().filter((image) => !srcs.has(image.src)));
	}

	/** 남은 장수에 따라 줄을 지우거나, 보통 사진으로 풀거나, 그대로 둔다. */
	private settle(images: Array<RowImage>): void {
		if (images.length === 0) {
			this.remove();
			return;
		}
		if (images.length === 1) {
			const [only] = images;
			this.replace(
				$createImageNode({
					src: only.src,
					altText: only.altText,
					caption: this.getLatest().__caption,
				}),
			);
			return;
		}
		this.setImages(images);
	}

	/**
	 * 줄을 풀어 사진을 한 장씩 세운다. 설명은 마지막 사진 아래로 옮긴다 —
	 * 줄 아래에 있던 글이니 묶음 맨 끝에 붙는 게 가장 가깝다.
	 */
	unpack(): void {
		const { __images: images, __caption: caption } = this.getLatest();
		let anchor: LexicalNode = this;
		images.forEach((image, index) => {
			const node = $createImageNode({
				src: image.src,
				altText: image.altText,
				caption: index === images.length - 1 ? caption : "",
			});
			anchor.insertAfter(node);
			anchor = node;
		});
		this.remove();
	}

	decorate(_editor: LexicalEditor): JSX.Element {
		return (
			<ImageRowComponent
				nodeKey={this.getKey()}
				images={this.__images}
				caption={this.__caption}
				uploading={this.__uploading}
			/>
		);
	}
}

export function $createImageRowNode(payload: {
	images: Array<RowImage>;
	caption?: string;
}): ImageRowNode {
	return $applyNodeReplacement(new ImageRowNode(payload));
}

export function $isImageRowNode(
	node: LexicalNode | null | undefined,
): node is ImageRowNode {
	return node instanceof ImageRowNode;
}
