import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
	$applyNodeReplacement,
	$getNodeByKey,
	CLICK_COMMAND,
	COMMAND_PRIORITY_LOW,
	DecoratorNode,
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

export type SerializedVideoNode = Spread<
	{ src: string; caption: string },
	SerializedLexicalNode
>;

export type VideoPayload = {
	src: string;
	caption?: string;
	/** 업로드 중이면 true — 저장 시에는 항상 false 로 직렬화된다. */
	uploading?: boolean;
	/** 0~100. 업로드 중일 때만 의미가 있다. */
	progress?: number;
	key?: NodeKey;
};

function VideoComponent({
	nodeKey,
	src,
	caption,
	uploading,
	progress,
}: {
	nodeKey: NodeKey;
	src: string;
	caption: string;
	uploading: boolean;
	progress: number;
}) {
	const [editor] = useLexicalComposerContext();
	const messages = useMessages();
	const [isSelected, setSelected, clearSelection] =
		useLexicalNodeSelection(nodeKey);
	const frameRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const $onDelete = () => {
			if (!isSelected) return false;
			editor.update(() => {
				const node = $getNodeByKey(nodeKey);
				if ($isVideoNode(node)) node.remove();
			});
			return true;
		};

		return mergeRegister(
			editor.registerCommand(
				CLICK_COMMAND,
				(event: MouseEvent) => {
					const frame = frameRef.current;
					if (!frame || !(event.target instanceof Node)) return false;
					if (!frame.contains(event.target)) return false;
					if (!event.shiftKey) clearSelection();
					setSelected(!isSelected);
					return false; // 재생 컨트롤은 그대로 눌리게 둔다
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
		<figure className="editor-video" data-uploading={uploading}>
			<div ref={frameRef} className={isSelected ? "selected" : undefined}>
				{/* biome-ignore lint/a11y/useMediaCaption: 자막 트랙은 아직 올릴 자리가 없다 */}
				<video
					src={src}
					controls
					playsInline
					// 열자마자 통째로 받지 않는다. 누르기 전까지는 첫 조각만.
					preload="metadata"
				/>
				{uploading ? (
					<div className="editor-video-progress">
						<div style={{ width: `${progress}%` }} />
					</div>
				) : null}
			</div>
			{uploading ? (
				<figcaption>{messages.media.uploadingPercent(progress)}</figcaption>
			) : (
				<MediaCaption
					value={caption}
					placeholder={messages.media.captionPlaceholder}
					onChange={(next) =>
						editor.update(() => {
							const node = $getNodeByKey(nodeKey);
							if ($isVideoNode(node)) node.setCaption(next);
						})
					}
				/>
			)}
		</figure>
	);
}

/**
 * 올린 영상.
 *
 * 트랜스코딩이 없어서 올린 파일이 그대로 나간다. preload="metadata" 로 열자마자
 * 통째로 내려받는 일은 막고, CDN 이 Range 를 받아주므로 탐색과 iOS 재생이 된다.
 */
export class VideoNode extends DecoratorNode<JSX.Element> {
	__src: string;
	__caption: string;
	__uploading: boolean;
	__progress: number;

	static getType(): string {
		return "video";
	}

	static clone(node: VideoNode): VideoNode {
		return new VideoNode(
			{
				src: node.__src,
				caption: node.__caption,
				uploading: node.__uploading,
				progress: node.__progress,
			},
			node.__key,
		);
	}

	constructor(payload: VideoPayload, key?: NodeKey) {
		super(key);
		this.__src = payload.src;
		this.__caption = payload.caption ?? "";
		this.__uploading = payload.uploading ?? false;
		this.__progress = payload.progress ?? 0;
	}

	static importJSON(serialized: SerializedVideoNode): VideoNode {
		return $createVideoNode({ src: serialized.src }).updateFromJSON(serialized);
	}

	updateFromJSON(serialized: LexicalUpdateJSON<SerializedVideoNode>): this {
		const self = super.updateFromJSON(serialized);
		self.__src = serialized.src;
		self.__caption = serialized.caption ?? "";
		self.__uploading = false;
		self.__progress = 0;
		return self;
	}

	exportJSON(): SerializedVideoNode {
		return {
			...super.exportJSON(),
			src: this.__src,
			caption: this.__caption,
		};
	}

	/*
	 * importDOM 을 두지 않는다. 아무 <video> 나 받아들이면 붙여넣기 한 번으로
	 * 남의 서버 주소가 본문에 박힌다 — 영상은 우리가 올린 것만 들어온다.
	 */

	exportDOM(): DOMExportOutput {
		const figure = document.createElement("figure");
		const video = document.createElement("video");
		video.setAttribute("src", this.__src);
		video.setAttribute("controls", "");
		video.setAttribute("playsinline", "");
		video.setAttribute("preload", "metadata");
		figure.appendChild(video);
		if (this.__caption) {
			const caption = document.createElement("figcaption");
			caption.textContent = this.__caption;
			figure.appendChild(caption);
		}
		return { element: figure };
	}

	createDOM(config: EditorConfig): HTMLElement {
		const span = document.createElement("span");
		const className = config.theme.video;
		if (className) span.className = className;
		return span;
	}

	updateDOM(): false {
		return false;
	}

	getTextContent(): string {
		return this.__caption;
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
		writable.__progress = 100;
	}

	/** 저장하며 올리는 동안만 켠다. 에디터 상태에는 저장되지 않는다. */
	setUploading(uploading: boolean): void {
		const writable = this.getWritable();
		writable.__uploading = uploading;
		if (!uploading) writable.__progress = 0;
	}

	setProgress(percent: number): void {
		this.getWritable().__progress = percent;
	}

	setCaption(caption: string): void {
		this.getWritable().__caption = caption;
	}

	decorate(_editor: LexicalEditor): JSX.Element {
		return (
			<VideoComponent
				nodeKey={this.getKey()}
				src={this.__src}
				caption={this.__caption}
				uploading={this.__uploading}
				progress={this.__progress}
			/>
		);
	}
}

export function $createVideoNode(payload: VideoPayload): VideoNode {
	return $applyNodeReplacement(new VideoNode(payload, payload.key));
}

export function $isVideoNode(
	node: LexicalNode | null | undefined,
): node is VideoNode {
	return node instanceof VideoNode;
}
