import type { LexicalEditor } from "lexical";
import { useMessages } from "../context.tsx";
import {
	DIVIDER_VARIANTS,
	type DividerVariant,
	INSERT_DIVIDER_COMMAND,
} from "../nodes/DividerNode.tsx";

/** 구분선 모양 다섯 가지. 이름 대신 실제 모양을 보여 준다. */
export function DividerPicker({
	editor,
	onPicked,
}: {
	editor: LexicalEditor;
	onPicked?: (variant: DividerVariant) => void;
}) {
	const m = useMessages();
	return (
		<div className="le-divider-picker" role="menu">
			{DIVIDER_VARIANTS.map((variant) => (
				<button
					key={variant}
					type="button"
					role="menuitem"
					aria-label={m.divider[variant]}
					title={m.divider[variant]}
					className="le-divider-choice"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => {
						editor.dispatchCommand(INSERT_DIVIDER_COMMAND, variant);
						onPicked?.(variant);
					}}
				>
					<hr className="le-divider-sample" data-variant={variant} />
				</button>
			))}
		</div>
	);
}
