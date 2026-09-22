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
import {
	EMBED_LABEL,
	type Embed,
	type EmbedProvider,
	embedSrc,
	embedThumbnail,
	embedWatchUrl,
} from "../media/embed.ts";
import { messagesOf } from "../messages/registry.ts";
import { Icon } from "../ui/icons.tsx";
import { MediaCaption } from "./MediaCaption.tsx";

export type SerializedEmbedNode = Spread<
	{ provider: EmbedProvider; videoId: string; caption: string },
	SerializedLexicalNode
>;

export type EmbedPayload = Embed & { caption?: string; key?: NodeKey };

function EmbedComponent({
	nodeKey,
	provider,
	videoId,
	caption,
}: {
	nodeKey: NodeKey;
	provider: EmbedProvider;
	videoId: string;
	caption: string;
}) {
	const [editor] = useLexicalComposerContext();
	const messages = useMessages();
	const [isSelected, setSelected, clearSelection] =
		useLexicalNodeSelection(nodeKey);
	const frameRef = useRef<HTMLDivElement>(null);
	const thumbnail = embedThumbnail({ provider, id: videoId });

	useEffect(() => {
		const $onDelete = () => {
			if (!isSelected) return false;
			editor.update(() => {
				const node = $getNodeByKey(nodeKey);
				if ($isEmbedNode(node)) node.remove();
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

	/*
	 * 쓰는 동안에는 진짜 iframe 을 띄우지 않는다. 재생기가 클릭을 가져가서 노드를
	 * 고르거나 지울 수 없고, 글 하나에 영상을 넷 넣으면 유튜브 재생기가 넷 뜬다.
	 */
	return (
		<figure className="editor-embed">
			<div
				ref={frameRef}
				className={`editor-embed-frame${isSelected ? " selected" : ""}`}
			>
				{thumbnail ? (
					<img src={thumbnail} alt="" loading="lazy" />
				) : (
					<div className="editor-embed-blank" />
				)}
				<span className="editor-embed-play">
					<Icon name="play" size={20} />
				</span>
				<span className="editor-embed-badge">{EMBED_LABEL[provider]}</span>
			</div>
			<MediaCaption
				value={caption}
				placeholder={messages.media.captionPlaceholder}
				onChange={(next) =>
					editor.update(() => {
						const node = $getNodeByKey(nodeKey);
						if ($isEmbedNode(node)) node.setCaption(next);
					})
				}
			/>
		</figure>
	);
}

/**
 * 유튜브·비메오 임베드.
 *
 * 저장하는 건 주소가 아니라 (제공자 + 검증된 id) 다. 본문 HTML 은 독자 화면에
 * 그대로 innerHTML 로 꽂히기 때문에, 붙여넣은 주소를 iframe src 에 흘려보내면
 * 그 자리가 곧 남의 스크립트를 실을 자리가 된다. id 는 lib/embed.ts 의 정규식을
 * 통과한 것만 들어오고, src 는 우리가 조립한다.
 */
export class EmbedNode extends DecoratorNode<JSX.Element> {
	__provider: EmbedProvider;
	__videoId: string;
	__caption: string;

	static getType(): string {
		return "embed";
	}

	static clone(node: EmbedNode): EmbedNode {
		return new EmbedNode(
			{
				provider: node.__provider,
				id: node.__videoId,
				caption: node.__caption,
			},
			node.__key,
		);
	}

	constructor(payload: EmbedPayload, key?: NodeKey) {
		super(key);
		this.__provider = payload.provider;
		this.__videoId = payload.id;
		this.__caption = payload.caption ?? "";
	}

	static importJSON(serialized: SerializedEmbedNode): EmbedNode {
		return $createEmbedNode({
			provider: serialized.provider,
			id: serialized.videoId,
		}).updateFromJSON(serialized);
	}

	updateFromJSON(serialized: LexicalUpdateJSON<SerializedEmbedNode>): this {
		const self = super.updateFromJSON(serialized);
		self.__provider = serialized.provider;
		self.__videoId = serialized.videoId;
		self.__caption = serialized.caption ?? "";
		return self;
	}

	exportJSON(): SerializedEmbedNode {
		return {
			...super.exportJSON(),
			provider: this.__provider,
			videoId: this.__videoId,
			caption: this.__caption,
		};
	}

	/*
	 * importDOM 을 두지 않는다. 붙여넣은 <iframe> 을 노드로 받아주면 어떤
	 * 주소든 본문에 들어온다. 임베드는 주소를 해석해서만 만든다.
	 */

	exportDOM(editor: LexicalEditor): DOMExportOutput {
		const embed: Embed = { provider: this.__provider, id: this.__videoId };
		const figure = document.createElement("figure");
		figure.className = "embed";

		const frame = document.createElement("div");
		frame.className = "embed-frame";
		const iframe = document.createElement("iframe");
		iframe.setAttribute("src", embedSrc(embed));
		iframe.setAttribute("title", EMBED_LABEL[this.__provider]);
		// 화면에 들어올 때까지 재생기를 내려받지 않는다.
		iframe.setAttribute("loading", "lazy");
		iframe.setAttribute("allowfullscreen", "");
		iframe.setAttribute(
			"allow",
			"accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen",
		);
		iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
		frame.appendChild(iframe);
		figure.appendChild(frame);

		// 임베드가 막힌 곳(RSS·메일)에서는 이 링크만 남는다.
		const caption = document.createElement("figcaption");
		const link = document.createElement("a");
		link.setAttribute("href", embedWatchUrl(embed));
		link.setAttribute("rel", "noopener noreferrer");
		link.setAttribute("target", "_blank");
		link.textContent =
			this.__caption ||
			messagesOf(editor).media.watchOn(EMBED_LABEL[this.__provider]);
		caption.appendChild(link);
		figure.appendChild(caption);

		return { element: figure };
	}

	createDOM(config: EditorConfig): HTMLElement {
		const span = document.createElement("span");
		const className = config.theme.embed;
		if (className) span.className = className;
		return span;
	}

	updateDOM(): false {
		return false;
	}

	getTextContent(): string {
		return (
			this.__caption ||
			embedWatchUrl({ provider: this.__provider, id: this.__videoId })
		);
	}

	isInline(): false {
		return false;
	}

	setCaption(caption: string): void {
		this.getWritable().__caption = caption;
	}

	decorate(_editor: LexicalEditor): JSX.Element {
		return (
			<EmbedComponent
				nodeKey={this.getKey()}
				provider={this.__provider}
				videoId={this.__videoId}
				caption={this.__caption}
			/>
		);
	}
}

export function $createEmbedNode(payload: EmbedPayload): EmbedNode {
	return $applyNodeReplacement(new EmbedNode(payload, payload.key));
}

export function $isEmbedNode(
	node: LexicalNode | null | undefined,
): node is EmbedNode {
	return node instanceof EmbedNode;
}
