import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { type ReactNode, useRef, useState } from "react";
import {
	type BlockId,
	editLink,
	type InsertId,
	insert,
	setBlock,
	setCodeLanguage,
} from "../actions.ts";
import {
	CODE_LANGUAGES,
	codeLanguageLabel,
	normalizeLanguage,
	PLAIN_LANGUAGE,
} from "../code-languages.ts";
import { useEditorEnv } from "../context.tsx";
import { cx } from "../cx.ts";
import { type Align, useToolbarState } from "../plugins/useToolbarState.ts";
import { DividerPicker } from "./DividerPicker.tsx";
import { Icon, type IconName } from "./icons.tsx";
import { Popover } from "./Popover.tsx";

/**
 * 넓은 화면의 도구 줄 두 칸 — 무엇을 넣을지(넣기 줄), 글자를 어떻게 할지(서식 줄).
 *
 * 늘 보이게 둔다. / 를 몰라도 사진을 넣을 수 있어야 한다. 좁은 화면에서는
 * 숨고 MobileBar 가 대신한다.
 *
 * `extra` 는 넣기 줄 맨 끝에 선 하나 건너 붙는다. 앱의 것(미디어 보관함 등)을
 * 같은 모양으로 세울 때 InsertButton 과 함께 쓴다.
 */
export function Toolbar({
	className,
	extra,
}: {
	className?: string;
	extra?: ReactNode;
}) {
	return (
		<div className={cx("le-toolbar", className)}>
			<InsertRow extra={extra} />
			<FormatRow />
		</div>
	);
}

/** 단추를 눌러도 본문 커서가 그 자리에 남게 한다. */
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

/**
 * 넣기 줄의 단추 한 칸(아이콘 위, 이름 아래). 앱이 넣기 줄에 제 단추를 붙일 때.
 * expanded 는 이 단추가 연 판이 열려 있는지 — 눌린 바탕으로 보인다.
 */
export function InsertButton({
	icon,
	label,
	expanded,
	onClick,
}: {
	icon: ReactNode;
	label: string;
	expanded?: boolean;
	onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
	return (
		<button
			type="button"
			className="le-insert-button"
			aria-expanded={expanded}
			onMouseDown={keepFocus}
			onClick={onClick}
		>
			{icon}
			<span className="le-insert-label">{label}</span>
		</button>
	);
}

const INSERT_GROUPS: Array<Array<{ id: InsertId; icon: IconName }>> = [
	[
		{ id: "image", icon: "image" },
		{ id: "imageRow", icon: "imageRow" },
		{ id: "video", icon: "video" },
		{ id: "embed", icon: "youtube" },
	],
	[
		{ id: "quote", icon: "quote" },
		{ id: "divider", icon: "minus" },
		{ id: "code", icon: "code" },
		{ id: "table", icon: "table" },
	],
	[{ id: "link", icon: "link" }],
];

export function InsertRow({
	className,
	extra,
}: {
	className?: string;
	extra?: ReactNode;
}) {
	const [editor] = useLexicalComposerContext();
	const env = useEditorEnv();
	const m = env.messages.insert;
	const dividerRef = useRef<HTMLButtonElement>(null);
	const [dividerOpen, setDividerOpen] = useState(false);

	return (
		<div
			className={cx("le-insert-row", className)}
			role="toolbar"
			aria-label={m.open}
		>
			{INSERT_GROUPS.map((group, index) => (
				<div className="le-group" key={group[0].id}>
					{index > 0 ? <span className="le-sep" aria-hidden="true" /> : null}
					{group.map(({ id, icon }) => (
						<button
							key={id}
							ref={id === "divider" ? dividerRef : undefined}
							type="button"
							className="le-insert-button"
							aria-haspopup={id === "divider" ? "menu" : undefined}
							aria-expanded={id === "divider" ? dividerOpen : undefined}
							onMouseDown={keepFocus}
							onClick={(event) => {
								if (id === "divider") {
									setDividerOpen((open) => !open);
									return;
								}
								void insert(editor, env, id, {
									anchor: event.currentTarget.getBoundingClientRect(),
								});
							}}
						>
							<Icon name={icon} size={20} strokeWidth={1.6} />
							<span className="le-insert-label">
								{m[id]}
								{id === "divider" ? (
									<Icon name="chevronDown" size={11} strokeWidth={2} />
								) : null}
							</span>
						</button>
					))}
				</div>
			))}

			{extra ? (
				<div className="le-group">
					<span className="le-sep" aria-hidden="true" />
					{extra}
				</div>
			) : null}

			<Popover
				anchor={dividerRef}
				open={dividerOpen}
				onClose={() => setDividerOpen(false)}
				placement="bottom-center"
				label={m.divider}
			>
				<DividerPicker editor={editor} onPicked={() => setDividerOpen(false)} />
			</Popover>
		</div>
	);
}

const HEADINGS: Array<BlockId> = ["paragraph", "h1", "h2", "h3"];

export function FormatRow({ className }: { className?: string }) {
	const { editor, state, formatText, align } = useToolbarState();
	const env = useEditorEnv();
	const m = env.messages;
	const pickerRef = useRef<HTMLButtonElement>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	// 코드블록 안에서만 나오는 언어 고르기
	const langRef = useRef<HTMLButtonElement>(null);
	const [langOpen, setLangOpen] = useState(false);

	const current = HEADINGS.includes(state.block) ? state.block : "paragraph";
	const language = normalizeLanguage(state.codeLanguage);

	const alignButton = (value: Align, icon: IconName, label: string) => (
		<ToolButton
			label={label}
			icon={icon}
			active={state.align === value}
			onClick={() => align(value)}
		/>
	);

	return (
		<div
			className={cx("le-format-row", className)}
			role="toolbar"
			aria-label={m.format.panel}
		>
			<button
				ref={pickerRef}
				type="button"
				className="le-block-picker"
				aria-haspopup="menu"
				aria-expanded={pickerOpen}
				aria-label={m.blocks.picker}
				onMouseDown={keepFocus}
				onClick={() => setPickerOpen((open) => !open)}
			>
				<span>{m.blocks[current]}</span>
				<Icon name="chevronDown" size={14} />
			</button>
			<Popover
				anchor={pickerRef}
				open={pickerOpen}
				onClose={() => setPickerOpen(false)}
				label={m.blocks.picker}
			>
				<div className="le-menu" role="menu">
					{HEADINGS.map((id) => (
						<button
							key={id}
							type="button"
							role="menuitemradio"
							aria-checked={current === id}
							className="le-menu-item le-block-choice"
							data-block={id}
							onMouseDown={keepFocus}
							onClick={() => {
								if (current !== id) setBlock(editor, id);
								setPickerOpen(false);
							}}
						>
							<span className="le-menu-label">{m.blocks[id]}</span>
							{current === id ? <Icon name="check" size={14} /> : null}
						</button>
					))}
				</div>
			</Popover>

			{state.block === "code" ? (
				<>
					<span className="le-sep" aria-hidden="true" />
					<button
						ref={langRef}
						type="button"
						className="le-block-picker"
						aria-haspopup="menu"
						aria-expanded={langOpen}
						aria-label={m.code.picker}
						onMouseDown={keepFocus}
						onClick={() => setLangOpen((open) => !open)}
					>
						<span>{codeLanguageLabel(language, m.code.plain)}</span>
						<Icon name="chevronDown" size={14} />
					</button>
					<Popover
						anchor={langRef}
						open={langOpen}
						onClose={() => setLangOpen(false)}
						label={m.code.picker}
					>
						<div className="le-menu le-menu-scroll" role="menu">
							{[
								{ id: PLAIN_LANGUAGE, label: m.code.plain },
								...CODE_LANGUAGES,
							].map(({ id, label }) => (
								<button
									key={id}
									type="button"
									role="menuitemradio"
									aria-checked={language === id}
									className="le-menu-item"
									onMouseDown={keepFocus}
									onClick={() => {
										if (language !== id) setCodeLanguage(editor, id);
										setLangOpen(false);
									}}
								>
									<span className="le-menu-label">{label}</span>
									{language === id ? <Icon name="check" size={14} /> : null}
								</button>
							))}
						</div>
					</Popover>
				</>
			) : null}

			<span className="le-sep" aria-hidden="true" />
			<ToolButton
				label={m.format.bold}
				icon="bold"
				bold
				active={state.isBold}
				onClick={() => formatText("bold")}
			/>
			<ToolButton
				label={m.format.italic}
				icon="italic"
				bold
				active={state.isItalic}
				onClick={() => formatText("italic")}
			/>
			<ToolButton
				label={m.format.underline}
				icon="underline"
				bold
				active={state.isUnderline}
				onClick={() => formatText("underline")}
			/>
			<ToolButton
				label={m.format.strikethrough}
				icon="strikethrough"
				bold
				active={state.isStrikethrough}
				onClick={() => formatText("strikethrough")}
			/>

			<span className="le-sep" aria-hidden="true" />
			{alignButton("left", "alignLeft", m.format.alignLeft)}
			{alignButton("center", "alignCenter", m.format.alignCenter)}
			{alignButton("right", "alignRight", m.format.alignRight)}

			<span className="le-sep" aria-hidden="true" />
			<ToolButton
				label={m.blocks.bulletList}
				icon="list"
				active={state.block === "bulletList"}
				onClick={() => setBlock(editor, "bulletList")}
			/>
			<ToolButton
				label={m.blocks.numberList}
				icon="listOrdered"
				active={state.block === "numberList"}
				onClick={() => setBlock(editor, "numberList")}
			/>
			<ToolButton
				label={m.blocks.checkList}
				icon="listChecks"
				active={state.block === "checkList"}
				onClick={() => setBlock(editor, "checkList")}
			/>

			<span className="le-sep" aria-hidden="true" />
			<ToolButton
				label={state.isLink ? m.format.unlink : m.format.link}
				icon={state.isLink ? "unlink" : "link"}
				active={state.isLink}
				onClick={(event) =>
					void editLink(
						editor,
						env,
						event.currentTarget.getBoundingClientRect(),
					)
				}
			/>
		</div>
	);
}

export function ToolButton({
	label,
	icon,
	active,
	bold,
	onClick,
	children,
}: {
	label: string;
	icon: IconName;
	active?: boolean;
	/** 글자 모양 단추는 선을 조금 굵게 — 작은 크기에서 B 와 I 가 흐려진다 */
	bold?: boolean;
	onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
	children?: ReactNode;
}) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={active}
			className={cx("le-icon-button", active && "is-active")}
			onMouseDown={keepFocus}
			onClick={onClick}
		>
			<Icon name={icon} size={16} strokeWidth={bold ? 2.1 : 1.8} />
			{children}
		</button>
	);
}

/**
 * 혼자 서는 에디터가 기본으로 세우는 도구 줄. Toolbar 와 같은 것이고,
 * 이름만 패키지 밖에서 알아보기 쉽게 둔다 (`toolbar={EditorToolbar}`).
 */
export { Toolbar as EditorToolbar };
