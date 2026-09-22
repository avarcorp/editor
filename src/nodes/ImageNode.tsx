import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
	$applyNodeReplacement,
	$getNodeByKey,
	CLICK_COMMAND,
	COMMAND_PRIORITY_LOW,
	DecoratorNode,
	type DOMConversionMap,
	type DOMExportOutput,
	type EditorConfig,
	KEY_BACKSPACE_COMMAND,
	KEY_DELETE_COMMAND,
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
import { MediaCaption } from "./MediaCaption.tsx";

export type SerializedImageNode = Spread<
	{
		src: string;
		altText: string;
		caption: string;
	},
	SerializedLexicalNode
>;

export type ImagePayload = {
	src: string;
	altText?: string;
	caption?: string;
	/** 업로드 중이면 true — 저장 시에는 항상 false 로 직렬화된다. */
	uploading?: boolean;
	key?: NodeKey;
};

function ImageComponent({
	nodeKey,
	src,
	altText,
	caption,
	uploading,
}: {
	nodeKey: NodeKey;
	src: string;
	altText: string;
	caption: string;
	uploading: boolean;
}) {
	const [editor] = useLexicalComposerContext();
	const messages = useMessages();
	const [isSelected, setSelected, clearSelection] =
		useLexicalNodeSelection(nodeKey);
	const imageRef = useRef<HTMLImageElement>(null);

	useEffect(() => {
		const $onDelete = () => {
			if (!isSelected) return false;
			editor.update(() => {
				const node = $getNodeByKey(nodeKey);
				if ($isImageNode(node)) node.remove();
			});
			return true;
		};

		return mergeRegister(
			editor.registerCommand(
				CLICK_COMMAND,
				(event: MouseEvent) => {
					if (event.target !== imageRef.current) return false;
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

	return (
		<figure className="editor-image" data-uploading={uploading}>
			<img
				ref={imageRef}
				src={src}
				alt={altText}
				className={isSelected ? "selected" : undefined}
				draggable={false}
			/>
			{uploading ? (
				<figcaption>{messages.media.uploading}</figcaption>
			) : (
				<MediaCaption
					value={caption}
					placeholder={messages.media.captionPlaceholder}
					onChange={(next) =>
						editor.update(() => {
							const node = $getNodeByKey(nodeKey);
							if ($isImageNode(node)) node.setCaption(next);
						})
					}
				/>
			)}
		</figure>
	);
}

export class ImageNode extends DecoratorNode<JSX.Element> {
	__src: string;
	__altText: string;
	__caption: string;
	/** blob: URL 로 미리 보여주는 동안만 true. 에디터 상태에는 저장하지 않는다. */
	__uploading: boolean;

	static getType(): string {
		return "image";
	}

	static clone(node: ImageNode): ImageNode {
		return new ImageNode(
			{
				src: node.__src,
				altText: node.__altText,
				caption: node.__caption,
				uploading: node.__uploading,
			},
			node.__key,
		);
	}

	constructor(payload: ImagePayload, key?: NodeKey) {
		super(key);
		this.__src = payload.src;
		this.__altText = payload.altText ?? "";
		this.__caption = payload.caption ?? "";
		this.__uploading = payload.uploading ?? false;
	}

	static importJSON(serialized: SerializedImageNode): ImageNode {
		return $createImageNode({ src: serialized.src }).updateFromJSON(serialized);
	}

	updateFromJSON(serialized: LexicalUpdateJSON<SerializedImageNode>): this {
		const self = super.updateFromJSON(serialized);
		self.__src = serialized.src;
		self.__altText = serialized.altText ?? "";
		self.__caption = serialized.caption ?? "";
		self.__uploading = false;
		return self;
	}

	exportJSON(): SerializedImageNode {
		return {
			...super.exportJSON(),
			src: this.__src,
			altText: this.__altText,
			caption: this.__caption,
		};
	}

	static importDOM(): DOMConversionMap | null {
		return {
			img: () => ({
				conversion: (element: HTMLElement) => {
					const img = element as HTMLImageElement;
					// blob:/data: 는 남의 브라우저에서 깨지므로 붙여넣기에서 제외한다.
					if (!/^https?:/.test(img.src)) return null;
					return {
						node: $createImageNode({ src: img.src, altText: img.alt }),
					};
				},
				priority: 0,
			}),
		};
	}

	exportDOM(): DOMExportOutput {
		const figure = document.createElement("figure");
		const img = document.createElement("img");
		img.setAttribute("src", this.__src);
		img.setAttribute("alt", this.__altText);
		img.setAttribute("loading", "lazy");
		figure.appendChild(img);
		if (this.__caption) {
			const caption = document.createElement("figcaption");
			caption.textContent = this.__caption;
			figure.appendChild(caption);
		}
		return { element: figure };
	}

	createDOM(config: EditorConfig): HTMLElement {
		const span = document.createElement("span");
		const className = config.theme.image;
		if (className) span.className = className;
		return span;
	}

	updateDOM(): false {
		return false;
	}

	getTextContent(): string {
		return this.__caption || this.__altText;
	}

	isInline(): false {
		return false;
	}

	getSrc(): string {
		return this.getLatest().__src;
	}

	setUploaded(src: string): void {
		const writable = this.getWritable();
		writable.__src = src;
		writable.__uploading = false;
	}

	/** 저장하며 올리는 동안만 켠다. 에디터 상태에는 저장되지 않는다. */
	setUploading(uploading: boolean): void {
		this.getWritable().__uploading = uploading;
	}

	setCaption(caption: string): void {
		this.getWritable().__caption = caption;
	}

	decorate(_editor: LexicalEditor): JSX.Element {
		return (
			<ImageComponent
				nodeKey={this.getKey()}
				src={this.__src}
				altText={this.__altText}
				caption={this.__caption}
				uploading={this.__uploading}
			/>
		);
	}
}

export function $createImageNode(payload: ImagePayload): ImageNode {
	return $applyNodeReplacement(new ImageNode(payload, payload.key));
}

export function $isImageNode(
	node: LexicalNode | null | undefined,
): node is ImageNode {
	return node instanceof ImageNode;
}
