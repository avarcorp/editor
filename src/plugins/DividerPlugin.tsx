import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { COMMAND_PRIORITY_LOW } from "lexical";
import { useEffect } from "react";
import {
	$createDividerNode,
	INSERT_DIVIDER_COMMAND,
	registerDividerMigration,
} from "../nodes/DividerNode.tsx";
import { $insertBlock } from "../nodes/insert-block.ts";

/** 구분선 넣기 + 예전 가로선을 새 구분선으로 바꾸기. */
export function DividerPlugin() {
	const [editor] = useLexicalComposerContext();

	useEffect(
		() =>
			mergeRegister(
				registerDividerMigration(editor),
				editor.registerCommand(
					INSERT_DIVIDER_COMMAND,
					(variant) => {
						editor.update(() => {
							$insertBlock($createDividerNode(variant));
						});
						return true;
					},
					COMMAND_PRIORITY_LOW,
				),
			),
		[editor],
	);

	return null;
}
