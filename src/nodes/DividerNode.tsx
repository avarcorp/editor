import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
	$applyNodeReplacement,
	$getNodeByKey,
	CLICK_COMMAND,
	COMMAND_PRIORITY_LOW,
	createCommand,
	DecoratorNode,
	type DOMConversionMap,
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
import { type JSX, useEffect } from "react";

export const DIVIDER_VARIANTS = [
	"line",
	"short",
	"bold",
	"dots",
	"diamond",
] as const;

export type DividerVariant = (typeof DIVIDER_VARIANTS)[number];

const isVariant = (value: unknown): value is DividerVariant =>
	DIVIDER_VARIANTS.includes(value as DividerVariant);

export type SerializedDividerNode = Spread<
	{ variant: DividerVariant },
	SerializedLexicalNode
>;

export const INSERT_DIVIDER_COMMAND: LexicalCommand<DividerVariant> =
	createCommand("INSERT_DIVIDER_COMMAND");

function DividerComponent({ nodeKey }: { nodeKey: NodeKey }) {
	const [editor] = useLexicalComposerContext();
	const [isSelected, setSelected, clearSelection] =
		useLexicalNodeSelection(nodeKey);

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
					if (event.target !== editor.getElementByKey(nodeKey)) return false;
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

	useEffect(() => {
		const element = editor.getElementByKey(nodeKey);
		if (element) element.dataset.selected = String(isSelected);
	}, [editor, isSelected, nodeKey]);

	return null;
}

/**
 * 구분선. 긴 선 · 짧은 선 · 굵은 선 · 점 셋 · 마름모 중 하나.
 *
 * 모양은 `<hr data-variant>` 하나로 싣고 그림은 CSS 가 그린다 (styles/reader.css).
 * 모양마다 태그를 달리하면 RSS 나 메일처럼 우리 CSS 가 없는 곳에서 선이
 * 사라진다. hr 이면 적어도 선 하나는 남는다.
 */
export class DividerNode extends DecoratorNode<JSX.Element | null> {
	__variant: DividerVariant;

	static getType(): string {
		return "divider";
	}

	static clone(node: DividerNode): DividerNode {
		return new DividerNode(node.__variant, node.__key);
	}

	constructor(variant: DividerVariant = "line", key?: NodeKey) {
		super(key);
		this.__variant = variant;
	}

	static importJSON(serialized: SerializedDividerNode): DividerNode {
		return $createDividerNode().updateFromJSON(serialized);
	}

	updateFromJSON(serialized: LexicalUpdateJSON<SerializedDividerNode>): this {
		const self = super.updateFromJSON(serialized);
		self.__variant = isVariant(serialized.variant)
			? serialized.variant
			: "line";
		return self;
	}

	exportJSON(): SerializedDividerNode {
		return { ...super.exportJSON(), variant: this.__variant };
	}

	static importDOM(): DOMConversionMap | null {
		return {
			hr: () => ({
				conversion: (element: HTMLElement) => {
					const variant = element.getAttribute("data-variant");
					return {
						node: $createDividerNode(isVariant(variant) ? variant : "line"),
					};
				},
				// 기본 가로선보다 먼저 받는다
				priority: 1,
			}),
		};
	}

	exportDOM(): DOMExportOutput {
		const hr = document.createElement("hr");
		hr.className = "divider";
		hr.setAttribute("data-variant", this.__variant);
		return { element: hr };
	}

	createDOM(config: EditorConfig): HTMLElement {
		const hr = document.createElement("hr");
		const className = config.theme.hr;
		if (className) hr.className = className;
		hr.setAttribute("data-variant", this.__variant);
		return hr;
	}

	updateDOM(prev: DividerNode, dom: HTMLElement): false {
		if (prev.__variant !== this.__variant) {
			dom.setAttribute("data-variant", this.__variant);
		}
		return false;
	}

	getTextContent(): string {
		return "\n";
	}

	isInline(): false {
		return false;
	}

	getVariant(): DividerVariant {
		return this.getLatest().__variant;
	}

	setVariant(variant: DividerVariant): void {
		this.getWritable().__variant = variant;
	}

	decorate(_editor: LexicalEditor): JSX.Element {
		return <DividerComponent nodeKey={this.getKey()} />;
	}
}

export function $createDividerNode(
	variant: DividerVariant = "line",
): DividerNode {
	return $applyNodeReplacement(new DividerNode(variant));
}

export function $isDividerNode(
	node: LexicalNode | null | undefined,
): node is DividerNode {
	return node instanceof DividerNode;
}

/**
 * 예전 글의 가로선을 새 구분선으로 바꾼다.
 *
 * 저장된 글에는 Lexical 기본 가로선(horizontalrule)이 들어 있다. 그 노드를
 * 목록에서 빼면 그 글들이 아예 안 열리므로 등록은 남겨 두고, 에디터에 올라오는
 * 순간 긴 선으로 갈아 끼운다. 다음 저장부터는 새 모양으로 남는다.
 */
export function registerDividerMigration(editor: LexicalEditor): () => void {
	return editor.registerNodeTransform(HorizontalRuleNode, (node) => {
		node.replace($createDividerNode("line"));
	});
}
