import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
	$getSelection,
	$setSelection,
	type BaseSelection,
	COMMAND_PRIORITY_LOW,
	FOCUS_COMMAND,
	SKIP_DOM_SELECTION_TAG,
} from "lexical";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	$setBlock,
	type BlockId,
	editLink,
	type InsertId,
	insert,
	setBlock,
} from "../actions.ts";
import { useEditorEnv } from "../context.tsx";
import { cx } from "../cx.ts";
import { type Align, useToolbarState } from "../plugins/useToolbarState.ts";
import { DividerPicker } from "./DividerPicker.tsx";
import { Icon, type IconName } from "./icons.tsx";
import { Popover } from "./Popover.tsx";

/** 기본 판(서식 · 더 넣기) 또는 앱이 붙인 판의 id */
type Panel = "format" | "more" | (string & {}) | null;

/**
 * 앱이 도구 줄에 붙이는 판. 단추는 인용구와 ⋯ 사이에 선다.
 *
 * 판이 열리면 키보드는 내려가 있다. 본문에 무엇을 넣으려면 atCursor 로 감싸서
 * 판을 열기 전의 커서 자리에 건다 — 그냥 editor.update 로 넣으면 커서가
 * 사라진 뒤라 글 끝에 붙는다.
 */
export type MobilePanel = {
	id: string;
	icon: ReactNode;
	label: string;
	render: (api: {
		close: () => void;
		/** 판을 열기 전 커서 자리에서 편집을 돈다. 열린 편집 안에서 $ 함수를 부른다. */
		atCursor: (run: () => void) => void;
	}) => ReactNode;
};

/** 키보드가 가린 높이. 키보드가 없으면 0. */
function useKeyboardInset(): number {
	const [inset, setInset] = useState(0);
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport) return;
		const update = () =>
			setInset(
				Math.max(
					0,
					Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
				),
			);
		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);
		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
		};
	}, []);
	return inset;
}

/** 판의 높이. 한 번 올라온 키보드 높이를 기억해 두면 판이 같은 자리를 채운다. */
const DEFAULT_PANEL = 300;

const MORE: Array<{
	id: InsertId | "numberList" | "checkList";
	icon: IconName;
}> = [
	{ id: "image", icon: "image" },
	{ id: "imageRow", icon: "imageRow" },
	{ id: "video", icon: "video" },
	{ id: "embed", icon: "youtube" },
	{ id: "quote", icon: "quote" },
	{ id: "divider", icon: "minus" },
	{ id: "code", icon: "code" },
	{ id: "table", icon: "table" },
	{ id: "link", icon: "link" },
	{ id: "numberList", icon: "listOrdered" },
	{ id: "checkList", icon: "listChecks" },
];

/**
 * 좁은 화면의 도구 줄. 키보드 바로 위에 붙는다.
 *
 * 자주 쓰는 넷(사진 · 서식 · 목록 · 인용구)만 꺼내 두고 나머지는 ⋯ 에 있다.
 * 서식이나 ⋯ 를 누르면 키보드를 내리고 그 자리에 판을 올린다 — 키보드 위에
 * 줄을 또 쌓으면 글 쓸 자리가 손바닥만 해진다. 글을 누르면 키보드로 돌아간다.
 *
 * `end` 에는 앱이 넣고 싶은 것(임시저장 단추 등)을 넣는다.
 */
export function MobileBar({
	end,
	count,
	className,
	panels = [],
}: {
	end?: ReactNode;
	/** 앱이 붙이는 판 (MobilePanel) */
	panels?: Array<MobilePanel>;
	/** 글자 수 등 짧은 표시 */
	count?: ReactNode;
	className?: string;
}) {
	const [editor] = useLexicalComposerContext();
	const env = useEditorEnv();
	const m = env.messages;
	const { state, formatText, align } = useToolbarState();
	const inset = useKeyboardInset();
	const [panel, setPanel] = useState<Panel>(null);
	const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL);
	const [dividerOpen, setDividerOpen] = useState(false);
	const dividerRef = useRef<HTMLButtonElement>(null);
	const saved = useRef<BaseSelection | null>(null);

	useEffect(() => {
		if (inset > 120) setPanelHeight(inset);
	}, [inset]);

	// 글을 다시 누르면(키보드가 올라오면) 판을 닫는다.
	useEffect(
		() =>
			mergeRegister(
				editor.registerCommand(
					FOCUS_COMMAND,
					() => {
						setPanel(null);
						setDividerOpen(false);
						return false;
					},
					COMMAND_PRIORITY_LOW,
				),
			),
		[editor],
	);

	const openPanel = (next: Panel) => {
		if (panel === next) {
			setPanel(null);
			editor.focus();
			return;
		}
		saved.current = editor
			.getEditorState()
			.read(() => $getSelection()?.clone() ?? null);
		setPanel(next);
		// 키보드를 내린다. 커서 자리는 위에서 기억해 두었다.
		const active = document.activeElement;
		if (active instanceof HTMLElement) active.blur();
	};

	/**
	 * 판에서 누른 것을 기억해 둔 커서 자리에 건다. DOM 선택은 건드리지 않는다 —
	 * 건드리면 브라우저가 본문에 초점을 돌려주고 키보드가 도로 올라온다.
	 */
	const atSaved = useCallback(
		(run: () => void) => {
			editor.update(
				() => {
					if (saved.current) $setSelection(saved.current.clone());
					run();
					saved.current = $getSelection()?.clone() ?? null;
				},
				{ tag: SKIP_DOM_SELECTION_TAG },
			);
		},
		[editor],
	);

	const toggleBlock = (id: BlockId) => {
		if (panel) atSaved(() => $setBlock(editor, id));
		else setBlock(editor, id);
	};

	const runMore = (id: (typeof MORE)[number]["id"], rect: DOMRect) => {
		if (id === "numberList" || id === "checkList") {
			toggleBlock(id);
			return;
		}
		if (id === "divider") {
			setDividerOpen((value) => !value);
			return;
		}
		if (saved.current) atSaved(() => {});
		setPanel(null);
		void insert(editor, env, id, { anchor: rect });
	};

	const alignButton = (value: Align, icon: IconName, label: string) => (
		<PanelButton
			icon={icon}
			label={label}
			active={state.align === value}
			onPress={() => atSaved(() => align(value))}
		/>
	);

	const barBottom = panel ? panelHeight : inset;

	return (
		<div className={cx("le-mobile", className)}>
			<div className="le-mobile-bar" style={{ bottom: barBottom }}>
				<BarButton
					icon="image"
					label={m.insert.image}
					onPress={() => void insert(editor, env, "image")}
				/>
				<BarButton
					icon="type"
					label={m.format.panel}
					active={panel === "format"}
					onPress={() => openPanel("format")}
				/>
				<BarButton
					icon="list"
					label={m.blocks.bulletList}
					active={state.block === "bulletList"}
					onPress={() => toggleBlock("bulletList")}
				/>
				<BarButton
					icon="quote"
					label={m.insert.quote}
					active={state.block === "quote"}
					onPress={() => toggleBlock("quote")}
				/>
				{panels.map((extra) => (
					<BarButton
						key={extra.id}
						icon={extra.icon}
						label={extra.label}
						active={panel === extra.id}
						onPress={() => openPanel(extra.id)}
					/>
				))}
				<BarButton
					icon="more"
					label={m.insert.more}
					active={panel === "more"}
					onPress={() => openPanel("more")}
				/>
				<span className="le-mobile-spacer" />
				{count ? <span className="le-mobile-count">{count}</span> : null}
				{end}
			</div>

			{panel ? (
				<div className="le-mobile-panel" style={{ height: panelHeight }}>
					{panel === "format" ? (
						<>
							<div className="le-segment">
								{(["paragraph", "h1", "h2", "h3"] as const).map((id) => (
									<button
										key={id}
										type="button"
										aria-pressed={state.block === id}
										onPointerDown={(event) => event.preventDefault()}
										onClick={() => {
											if (state.block !== id)
												atSaved(() => $setBlock(editor, id));
										}}
									>
										{m.blocks[id]}
									</button>
								))}
							</div>
							<div className="le-panel-row">
								<div className="le-panel-group" style={{ flex: 4 }}>
									<PanelButton
										icon="bold"
										label={m.format.bold}
										active={state.isBold}
										onPress={() => atSaved(() => formatText("bold"))}
									/>
									<PanelButton
										icon="italic"
										label={m.format.italic}
										active={state.isItalic}
										onPress={() => atSaved(() => formatText("italic"))}
									/>
									<PanelButton
										icon="underline"
										label={m.format.underline}
										active={state.isUnderline}
										onPress={() => atSaved(() => formatText("underline"))}
									/>
									<PanelButton
										icon="strikethrough"
										label={m.format.strikethrough}
										active={state.isStrikethrough}
										onPress={() => atSaved(() => formatText("strikethrough"))}
									/>
								</div>
								<div className="le-panel-group" style={{ flex: 3 }}>
									{alignButton("left", "alignLeft", m.format.alignLeft)}
									{alignButton("center", "alignCenter", m.format.alignCenter)}
									{alignButton("right", "alignRight", m.format.alignRight)}
								</div>
							</div>
							<div className="le-panel-row">
								<div className="le-panel-group" style={{ flex: 3 }}>
									<PanelButton
										icon="list"
										label={m.blocks.bulletList}
										active={state.block === "bulletList"}
										onPress={() => toggleBlock("bulletList")}
									/>
									<PanelButton
										icon="listOrdered"
										label={m.blocks.numberList}
										active={state.block === "numberList"}
										onPress={() => toggleBlock("numberList")}
									/>
									<PanelButton
										icon="listChecks"
										label={m.blocks.checkList}
										active={state.block === "checkList"}
										onPress={() => toggleBlock("checkList")}
									/>
								</div>
								<div className="le-panel-group" style={{ flex: 1 }}>
									<PanelButton
										icon={state.isLink ? "unlink" : "link"}
										label={state.isLink ? m.format.unlink : m.format.link}
										active={state.isLink}
										onPress={(rect) => {
											atSaved(() => {});
											setPanel(null);
											void editLink(editor, env, rect);
										}}
									/>
								</div>
							</div>
							<p className="le-panel-hint">{m.mobile.backToKeyboard}</p>
						</>
					) : panel !== "more" ? (
						(panels
							.find((extra) => extra.id === panel)
							?.render({
								close: () => setPanel(null),
								atCursor: atSaved,
							}) ?? null)
					) : (
						<div className="le-grid">
							{MORE.map(({ id, icon }) => (
								<button
									key={id}
									ref={id === "divider" ? dividerRef : undefined}
									type="button"
									className="le-grid-item"
									onPointerDown={(event) => event.preventDefault()}
									onClick={(event) =>
										runMore(id, event.currentTarget.getBoundingClientRect())
									}
								>
									<span className="le-grid-icon">
										<Icon name={icon} size={21} strokeWidth={1.6} />
									</span>
									<span className="le-grid-label">
										{id === "numberList"
											? m.blocks.numberList
											: id === "checkList"
												? m.blocks.checkList
												: m.insert[id]}
									</span>
								</button>
							))}
						</div>
					)}
				</div>
			) : null}

			<Popover
				anchor={dividerRef}
				open={panel === "more" && dividerOpen}
				onClose={() => setDividerOpen(false)}
				placement="bottom-center"
				label={m.insert.divider}
			>
				<DividerPicker
					editor={editor}
					onPicked={() => {
						setDividerOpen(false);
						setPanel(null);
					}}
				/>
			</Popover>
		</div>
	);
}

function BarButton({
	icon,
	label,
	active,
	onPress,
}: {
	/** 기본 단추는 이름, 앱이 붙인 단추는 그림 그대로 */
	icon: IconName | ReactNode;
	label: string;
	active?: boolean;
	onPress: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={active}
			className={cx("le-bar-button", active && "is-active")}
			// 누르는 순간 본문 초점을 뺏지 않는다 — 키보드가 깜빡이지 않게
			onPointerDown={(event) => event.preventDefault()}
			onClick={onPress}
		>
			{typeof icon === "string" ? (
				<Icon
					name={icon as IconName}
					size={21}
					strokeWidth={icon === "more" ? 2.2 : 1.7}
				/>
			) : (
				icon
			)}
		</button>
	);
}

function PanelButton({
	icon,
	label,
	active,
	onPress,
}: {
	icon: IconName;
	label: string;
	active?: boolean;
	onPress: (rect: DOMRect) => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={active}
			className={cx("le-panel-button", active && "is-active")}
			onPointerDown={(event) => event.preventDefault()}
			onClick={(event) => onPress(event.currentTarget.getBoundingClientRect())}
		>
			<Icon name={icon} size={19} strokeWidth={1.9} />
		</button>
	);
}

/** 혼자 서는 에디터의 좁은 화면 도구 줄. MobileBar 와 같은 것이다. */
export { MobileBar as EditorMobileBar };
