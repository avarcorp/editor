import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
	COMMAND_PRIORITY_LOW,
	type NodeKey,
	SELECTION_CHANGE_COMMAND,
} from "lexical";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorEnv } from "../context.tsx";
import { DividerPicker } from "../ui/DividerPicker.tsx";
import { Icon } from "../ui/icons.tsx";
import { insertItems } from "../ui/menu-items.ts";
import { Popover } from "../ui/Popover.tsx";
import { $emptyLineKey } from "./empty-line.ts";
import { useIsComposing } from "./useIsComposing.ts";

type Spot = { key: NodeKey; top: number };

/**
 * 빈 줄 왼쪽의 [+].
 *
 * / 를 모르는 사람을 위한 문이다. 누르면 / 메뉴와 같은 넣기 목록이 뜬다.
 * 좁은 화면에서는 CSS 가 숨긴다 — 거기서는 키보드 위 도구 줄이 이 일을 한다.
 */
export function BlockInserterPlugin({
	anchorRef,
}: {
	/** 버튼 위치의 기준이 되는 상자 (본문을 감싼 요소) */
	anchorRef: React.RefObject<HTMLElement | null>;
}) {
	const [editor] = useLexicalComposerContext();
	const env = useEditorEnv();
	const isComposing = useIsComposing();
	const [spot, setSpot] = useState<Spot | null>(null);
	const [open, setOpen] = useState(false);
	const [dividerOpen, setDividerOpen] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const dividerRef = useRef<HTMLButtonElement>(null);

	const items = useMemo(() => insertItems(env.messages), [env.messages]);

	const measure = useCallback(() => {
		const key = editor.getEditorState().read($emptyLineKey);
		const line = key ? editor.getElementByKey(key) : null;
		const box = anchorRef.current;
		if (!key || !line || !box) {
			setSpot(null);
			return;
		}
		const lineRect = line.getBoundingClientRect();
		const boxRect = box.getBoundingClientRect();
		setSpot({ key, top: lineRect.top - boxRect.top + lineRect.height / 2 });
	}, [anchorRef, editor]);

	useEffect(
		() =>
			mergeRegister(
				editor.registerUpdateListener(() => measure()),
				editor.registerCommand(
					SELECTION_CHANGE_COMMAND,
					() => {
						measure();
						return false;
					},
					COMMAND_PRIORITY_LOW,
				),
			),
		[editor, measure],
	);

	// 줄을 벗어나면 메뉴도 닫는다
	useEffect(() => {
		if (!spot) {
			setOpen(false);
			setDividerOpen(false);
		}
	}, [spot]);

	if (!spot || isComposing || !editor.isEditable()) return null;

	const close = () => {
		setOpen(false);
		setDividerOpen(false);
	};

	return (
		<>
			<button
				ref={buttonRef}
				type="button"
				className="le-inserter"
				style={{ top: spot.top }}
				aria-label={env.messages.insert.open}
				aria-haspopup="menu"
				aria-expanded={open}
				// 커서가 빈 줄에 그대로 있어야 그 자리에 넣는다
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => setOpen((value) => !value)}
			>
				<Icon name="plus" size={15} strokeWidth={2} />
			</button>

			<Popover
				anchor={buttonRef}
				open={open}
				onClose={close}
				label={env.messages.insert.open}
			>
				<div className="le-menu" role="menu">
					{items.map((item) => (
						<button
							key={item.id}
							ref={item.submenu ? dividerRef : undefined}
							type="button"
							role="menuitem"
							aria-haspopup={item.submenu ? "menu" : undefined}
							aria-expanded={item.submenu ? dividerOpen : undefined}
							className="le-menu-item"
							data-active={item.submenu ? dividerOpen : undefined}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								if (item.submenu) {
									setDividerOpen((value) => !value);
									return;
								}
								const rect = buttonRef.current?.getBoundingClientRect() ?? null;
								close();
								item.run(editor, env, rect);
							}}
						>
							<span className="le-menu-icon">
								<Icon name={item.icon} size={16} />
							</span>
							<span className="le-menu-label">{item.label}</span>
							{item.submenu ? (
								<Icon name="chevronRight" size={14} className="le-menu-more" />
							) : null}
						</button>
					))}
				</div>
			</Popover>

			<Popover
				anchor={dividerRef}
				open={open && dividerOpen}
				onClose={() => setDividerOpen(false)}
				placement="right-start"
				label={env.messages.insert.divider}
			>
				<DividerPicker editor={editor} onPicked={close} />
			</Popover>
		</>
	);
}
