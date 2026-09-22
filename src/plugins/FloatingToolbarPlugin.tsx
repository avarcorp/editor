import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_LOW,
	SELECTION_CHANGE_COMMAND,
} from "lexical";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { editLink } from "../actions.ts";
import { useEditorEnv } from "../context.tsx";
import { cx } from "../cx.ts";
import { Icon } from "../ui/icons.tsx";
import { useIsComposing } from "./useIsComposing.ts";
import { useToolbarState } from "./useToolbarState.ts";

type Position = { top: number; left: number } | null;

/**
 * 텍스트를 드래그하면 위에 뜨는 서식 툴바.
 *
 * 한글 조합 중에는 숨긴다 — `한` 을 만드는 동안 selection 이 계속 바뀌어서
 * 툴바가 글자마다 튀어다니는 걸 막으려는 것.
 */
export function FloatingToolbarPlugin({
	anchorRef,
}: {
	anchorRef: React.RefObject<HTMLElement | null>;
}) {
	const [editor] = useLexicalComposerContext();
	const { state, formatText } = useToolbarState();
	const env = useEditorEnv();
	const m = env.messages.format;
	const isComposing = useIsComposing();
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<Position>(null);

	const updatePosition = useCallback(() => {
		const anchor = anchorRef.current;
		const toolbar = toolbarRef.current;
		if (!anchor || !toolbar) return;

		const selection = $getSelection();
		const nativeSelection = window.getSelection();

		if (
			!$isRangeSelection(selection) ||
			selection.isCollapsed() ||
			!nativeSelection ||
			nativeSelection.rangeCount === 0 ||
			editor.getRootElement()?.contains(nativeSelection.anchorNode) !== true
		) {
			setPosition(null);
			return;
		}

		const range = nativeSelection.getRangeAt(0);
		const rect = range.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) {
			setPosition(null);
			return;
		}

		const anchorRect = anchor.getBoundingClientRect();
		const toolbarRect = toolbar.getBoundingClientRect();

		const left = Math.min(
			Math.max(
				rect.left - anchorRect.left + rect.width / 2 - toolbarRect.width / 2,
				4,
			),
			anchorRect.width - toolbarRect.width - 4,
		);

		setPosition({
			top: rect.top - anchorRect.top - toolbarRect.height - 10,
			left,
		});
	}, [anchorRef, editor]);

	useEffect(() => {
		if (isComposing) {
			setPosition(null);
			return;
		}

		return mergeRegister(
			editor.registerUpdateListener(({ editorState }) => {
				editorState.read(updatePosition);
			}),
			editor.registerCommand(
				SELECTION_CHANGE_COMMAND,
				() => {
					editor.getEditorState().read(updatePosition);
					return false;
				},
				COMMAND_PRIORITY_LOW,
			),
		);
	}, [editor, isComposing, updatePosition]);

	useLayoutEffect(() => {
		const onScroll = () => editor.getEditorState().read(updatePosition);
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onScroll);
		return () => {
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onScroll);
		};
	}, [editor, updatePosition]);

	const visible = position !== null && !isComposing;

	return (
		<div
			ref={toolbarRef}
			className="le-floating"
			data-visible={visible}
			style={{
				top: position?.top ?? -9999,
				left: position?.left ?? -9999,
				pointerEvents: visible ? "auto" : "none",
			}}
		>
			<FloatingButton
				label={m.bold}
				active={state.isBold}
				onClick={() => formatText("bold")}
			>
				<Icon name="bold" size={16} strokeWidth={2} />
			</FloatingButton>
			<FloatingButton
				label={m.italic}
				active={state.isItalic}
				onClick={() => formatText("italic")}
			>
				<Icon name="italic" size={16} strokeWidth={2} />
			</FloatingButton>
			<FloatingButton
				label={m.strikethrough}
				active={state.isStrikethrough}
				onClick={() => formatText("strikethrough")}
			>
				<Icon name="strikethrough" size={16} strokeWidth={2} />
			</FloatingButton>
			<FloatingButton
				label={m.inlineCode}
				active={state.isCode}
				onClick={() => formatText("code")}
			>
				<Icon name="inlineCode" size={16} strokeWidth={2} />
			</FloatingButton>
			<FloatingButton
				label={state.isLink ? m.unlink : m.link}
				active={state.isLink}
				onClick={() => {
					const range = window.getSelection()?.getRangeAt(0);
					void editLink(editor, env, range?.getBoundingClientRect() ?? null);
				}}
			>
				<Icon name="link" size={16} strokeWidth={2} />
			</FloatingButton>
		</div>
	);
}

function FloatingButton({
	active,
	label,
	onClick,
	children,
}: {
	active?: boolean;
	label: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={active}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onClick}
			className={cx("le-icon-button", active && "is-active")}
		>
			{children}
		</button>
	);
}
