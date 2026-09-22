import { $isLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
	$getSelection,
	$isElementNode,
	$isRangeSelection,
	COMMAND_PRIORITY_CRITICAL,
	type ElementFormatType,
	FORMAT_ELEMENT_COMMAND,
	FORMAT_TEXT_COMMAND,
	SELECTION_CHANGE_COMMAND,
	type TextFormatType,
} from "lexical";
import { useCallback, useEffect, useState } from "react";
import {
	$currentBlock,
	$currentCodeLanguage,
	type BlockId,
} from "../actions.ts";

export type Align = "left" | "center" | "right";

export type ToolbarState = {
	block: BlockId;
	align: Align;
	isBold: boolean;
	isItalic: boolean;
	isUnderline: boolean;
	isStrikethrough: boolean;
	isCode: boolean;
	isLink: boolean;
	/** 커서가 코드블록 안이면 그 언어 (안 골랐으면 null) */
	codeLanguage: string | null;
};

const INITIAL_STATE: ToolbarState = {
	block: "paragraph",
	align: "left",
	isBold: false,
	isItalic: false,
	isUnderline: false,
	isStrikethrough: false,
	isCode: false,
	isLink: false,
	codeLanguage: null,
};

/** Lexical 의 정렬 값을 세 가지로 접는다. 비어 있거나 start 면 왼쪽. */
function toAlign(format: ElementFormatType): Align {
	if (format === "center") return "center";
	if (format === "right" || format === "end") return "right";
	return "left";
}

function $readState(): ToolbarState | null {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return null;

	const node = selection.anchor.getNode();
	const element = $isElementNode(node)
		? node
		: $findMatchingParent(
				node,
				(parent) => $isElementNode(parent) && !parent.isInline(),
			);
	const align =
		element && $isElementNode(element)
			? toAlign(element.getFormatType())
			: "left";

	return {
		block: $currentBlock() ?? "paragraph",
		align,
		isBold: selection.hasFormat("bold"),
		isItalic: selection.hasFormat("italic"),
		isUnderline: selection.hasFormat("underline"),
		isStrikethrough: selection.hasFormat("strikethrough"),
		isCode: selection.hasFormat("code"),
		isLink:
			$isLinkNode(node) || $findMatchingParent(node, $isLinkNode) !== null,
		codeLanguage: $currentCodeLanguage(),
	};
}

/** 지금 선택 영역의 서식 상태와, 서식을 거는 함수. */
export function useToolbarState() {
	const [editor] = useLexicalComposerContext();
	const [state, setState] = useState<ToolbarState>(INITIAL_STATE);

	useEffect(() => {
		const sync = () => {
			const next = $readState();
			if (next) setState(next);
		};
		return mergeRegister(
			editor.registerUpdateListener(({ editorState }) =>
				editorState.read(sync),
			),
			editor.registerCommand(
				SELECTION_CHANGE_COMMAND,
				() => {
					sync();
					return false;
				},
				COMMAND_PRIORITY_CRITICAL,
			),
		);
	}, [editor]);

	const formatText = useCallback(
		(format: TextFormatType) =>
			editor.dispatchCommand(FORMAT_TEXT_COMMAND, format),
		[editor],
	);

	const align = useCallback(
		(next: Align) => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, next),
		[editor],
	);

	return { editor, state, formatText, align };
}
