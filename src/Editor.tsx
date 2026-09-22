import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import {
	$createParagraphNode,
	$getRoot,
	CLEAR_HISTORY_COMMAND,
	type Klass,
	type LexicalEditor,
	type LexicalNode,
} from "lexical";
import {
	type ComponentType,
	createElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
	type Ref,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { EditorEnvContext, useEditorEnv } from "./context.tsx";
import { cx } from "./cx.ts";
import { type EditorContent, readEditorContent } from "./format/serialize.ts";
import { type EditorStats, measureText } from "./format/stats.ts";
import { TRANSFORMERS } from "./format/transformers.ts";
import {
	$insertMedia,
	type MediaLayout,
	type MediaRef,
} from "./media/library.ts";
import { uploadPendingMedia } from "./media/media-upload.ts";
import { createPendingMedia, type UploadFile } from "./media/pending-media.ts";
import { DEFAULT_LIMITS, type MediaLimits } from "./media/validate.ts";
import { ko } from "./messages/ko.ts";
import { bindMessages } from "./messages/registry.ts";
import type { EditorMessages } from "./messages/types.ts";
import { editorNodes } from "./nodes/index.ts";
import { registerAutoSave } from "./plugins/autosave.ts";
import { BlockInserterPlugin } from "./plugins/BlockInserterPlugin.tsx";
import { CaretFollowPlugin } from "./plugins/CaretFollowPlugin.tsx";
import { CodeHighlightPlugin } from "./plugins/CodeHighlightPlugin.tsx";
import { $placeCaretAtEnd } from "./plugins/caret-follow.ts";
import { DividerPlugin } from "./plugins/DividerPlugin.tsx";
import { FloatingToolbarPlugin } from "./plugins/FloatingToolbarPlugin.tsx";
import { MediaDropPlugin } from "./plugins/MediaDropPlugin.tsx";
import { MediaPlugin } from "./plugins/MediaPlugin.tsx";
import { SlashMenuPlugin } from "./plugins/SlashMenuPlugin.tsx";
import { useIsComposing } from "./plugins/useIsComposing.ts";
import { editorTheme } from "./theme.ts";
import { placeholderParts, placeholderText } from "./ui/placeholder.ts";
import { useUrlPrompt } from "./ui/UrlPrompt.tsx";

export type EditorHandle = {
	/**
	 * 저장할 본문. 미리보기로 붙여 둔 사진·영상을 먼저 올리고 주소를 바꾼 다음
	 * 직렬화한다 — 순서가 반대면 글쓴이 화면에서만 보이는 blob: 주소가 저장된다.
	 * dropped 는 되살릴 수 없어서 본문에서 뺀 미리보기 수.
	 */
	save: () => Promise<EditorContent & { dropped: number }>;
	/** 올리지 않고 지금 본문만 읽는다. */
	read: () => EditorContent;
	/** 글자도 사진도 없는가. 저장할 값이 있는지 볼 때. */
	isEmpty: () => boolean;
	/** 다른 글로 갈아 끼운다 (저장해 둔 Lexical JSON). */
	setContent: (json: string) => void;
	/** 본문을 비운다. */
	clear: () => void;
	focus: () => void;
	/**
	 * 이미 올라가 있는 사진 · 영상을 커서 자리에 넣는다. 앱의 미디어 보관함용.
	 * 커서가 없으면 글 끝에 붙는다.
	 */
	insertMedia: (items: Array<MediaRef>, layout?: MediaLayout) => void;
	/** Lexical 을 직접 만져야 할 때 */
	lexical: () => LexicalEditor | null;
};

export type MediaAdapter = {
	/** 파일을 올리고 공개 주소를 돌려준다. 사람에게 보여 줄 실패는 UploadError 로. */
	upload: UploadFile;
	limits?: Partial<MediaLimits>;
};

type EditorCommonProps = {
	/** 저장해 둔 Lexical JSON. 새 글이면 비운다. */
	initial?: string | null;
	/** 없으면 사진·영상을 넣을 수 없다. */
	media?: MediaAdapter;
	messages?: EditorMessages;
	editable?: boolean;
	/**
	 * 기본 노드에 더할 커스텀 노드 (멘션 · 각주 같은 것).
	 *
	 * Lexical 은 노드를 만들 때 한 번만 받으므로 여기서만 넣을 수 있다. 붙인
	 * 노드가 내보내는 HTML 은 독자 화면에서 걸러지니, sanitizeHtml 에도 같은
	 * 것을 알려야 한다 (format/sanitize.ts SanitizeOptions).
	 */
	nodes?: Array<Klass<LexicalNode>>;
	/** 마지막 편집에서 이만큼 조용하면 부른다. */
	onAutoSave?: (handle: EditorHandle) => void;
	autoSaveDelay?: number;
	onStats?: (stats: EditorStats) => void;
	/** 사람에게 알릴 문장 — 형식이 틀린 파일, 에디터 오류 등 */
	onNotify?: (message: string) => void;
	handleRef?: Ref<EditorHandle>;
	namespace?: string;
};

/**
 * 혼자 서는 쪽. 도구 줄과 본문을 여기서 세운다.
 * 에디터만 띄우는 화면(새 창)이 이 모양이다.
 */
type StandaloneProps = {
	/**
	 * 맨 위에 세울 도구 줄. 컴포넌트로 주면 여기서 만들어 붙이고, 만들어 둔
	 * 요소를 주면 그대로 쓴다. 주지 않으면 도구 줄이 없다.
	 */
	toolbar?: ComponentType | ReactElement | null;
	/** 좁은 화면 도구 줄. 규칙은 toolbar 와 같다. */
	mobileBar?: ComponentType | ReactElement | null;
	/** 글자를 끌었을 때 뜨는 작은 줄. 기본은 켬. */
	floatingToolbar?: boolean;
	/** 본문 칸에 입힐 활자 클래스 (앱의 .prose 등) */
	className?: string;
	/** 빈 본문 안내. 없으면 messages 의 것. */
	placeholder?: string;
	children?: undefined;
};

/**
 * 조립하는 쪽. 배치를 앱이 짠다 — <Toolbar /> · <Content /> · <MobileBar /> 와
 * 앱의 것(제목 칸 등)을 섞어 넣는다.
 *
 * 이쪽을 고르면 위 슬롯은 쓸 수 없다. 자리를 앱이 정하므로 패키지가 끼워 넣을
 * 곳이 없고, 받아만 두고 무시하면 "켜 뒀는데 안 나온다"가 된다.
 */
type ComposedProps = {
	children: ReactNode;
	toolbar?: never;
	mobileBar?: never;
	floatingToolbar?: never;
	className?: never;
	placeholder?: never;
};

export type EditorProps = EditorCommonProps & (StandaloneProps | ComposedProps);

/**
 * 에디터.
 *
 * 무엇을 어디에 둘지는 앱이 정한다. 여기서는 Lexical 과 공용 값, 늘 필요한
 * 플러그인만 세우고 부품은 children 으로 받는다:
 *
 *   <Editor media={{ upload }} handleRef={ref} onAutoSave={…}>
 *     <Toolbar />
 *     <input …제목 />
 *     <Content />
 *     <MobileBar end={…} />
 *   </Editor>
 */
export function Editor(props: EditorProps) {
	// 공개 타입은 유니온이라 바로 구조분해할 수 없다. 안쪽에서 한 모양으로 본다.
	const {
		initial,
		media,
		messages = ko,
		editable = true,
		nodes,
		onAutoSave,
		autoSaveDelay = 1500,
		onStats,
		onNotify,
		handleRef,
		namespace = "editor",
		className,
		placeholder,
		toolbar,
		mobileBar,
		floatingToolbar = true,
		children,
	} = props as EditorCommonProps & StandaloneProps & { children?: ReactNode };

	// 최신 콜백을 ref 로 — 바뀔 때마다 플러그인이 다시 걸리지 않게
	const notifyRef = useRef(onNotify);
	notifyRef.current = onNotify;
	const uploadRef = useRef(media?.upload);
	uploadRef.current = media?.upload;

	/*
	 * 붙인 사진·영상은 여기서 기다린다. 화면 하나에 하나뿐이라 한 번만 만든다 —
	 * 다시 만들면 맡겨 둔 파일이 샌다.
	 */
	const storeRef = useRef<ReturnType<typeof createPendingMedia> | null>(null);
	if (media && !storeRef.current) {
		storeRef.current = createPendingMedia({
			upload: (file, options) => {
				const upload = uploadRef.current;
				if (!upload) return Promise.reject(new Error("no upload"));
				return upload(file, options);
			},
		});
	}
	const store = storeRef.current;
	useEffect(() => () => store?.clear(), [store]);

	/*
	 * 노드 목록은 한 번 정해지면 못 바꾼다. 앱이 렌더마다 새 배열을 만들어도
	 * 에디터를 다시 세우지 않도록 처음 값만 잡아 둔다.
	 */
	const nodesRef = useRef<Array<Klass<LexicalNode>> | null>(null);
	if (!nodesRef.current) {
		nodesRef.current = nodes ? [...editorNodes, ...nodes] : editorNodes;
	}
	const allNodes = nodesRef.current;

	const { askUrl, host } = useUrlPrompt();
	const limits = media?.limits;

	const env = useMemo(
		() => ({
			messages,
			limits: {
				image: limits?.image ?? DEFAULT_LIMITS.image,
				video: limits?.video ?? DEFAULT_LIMITS.video,
			},
			media: store,
			notify: (message: string) => notifyRef.current?.(message),
			askUrl,
		}),
		[messages, limits?.image, limits?.video, store, askUrl],
	);

	return (
		<LexicalComposer
			initialConfig={{
				namespace,
				theme: editorTheme,
				nodes: allNodes,
				editable,
				editorState: initial || undefined,
				onError: (error) => {
					console.error("[editor]", error);
					notifyRef.current?.(messages.crashed);
				},
			}}
		>
			<EditorEnvContext.Provider value={env}>
				{children ?? (
					<Standalone
						className={className}
						placeholder={placeholder}
						toolbar={toolbar}
						mobileBar={mobileBar}
						floatingToolbar={floatingToolbar}
					/>
				)}

				<HistoryPlugin />
				<ListPlugin />
				<CheckListPlugin />
				<LinkPlugin />
				<ClickableLinkPlugin />
				<TablePlugin />
				<TabIndentationPlugin />
				<CodeHighlightPlugin />
				<DividerPlugin />
				<MarkdownShortcutPlugin transformers={TRANSFORMERS} />

				{editable ? (
					<>
						<SlashMenuPlugin />
						<CaretFollowPlugin />
						{store ? <MediaPlugin /> : null}
						{onAutoSave ? (
							<AutoSavePlugin onSave={onAutoSave} delayMs={autoSaveDelay} />
						) : null}
						{onStats ? <StatsPlugin onStats={onStats} /> : null}
					</>
				) : null}

				<EditablePlugin editable={editable} />
				<HandlePlugin handleRef={handleRef} />
				{host}
			</EditorEnvContext.Provider>
		</LexicalComposer>
	);
}

/** 컴포넌트로 줬으면 만들고, 만들어 둔 요소면 그대로. 없으면 안 그린다. */
function slot(
	given: ComponentType | ReactElement | null | undefined,
): ReactNode {
	if (!given) return null;
	return isValidElement(given) ? given : createElement(given as ComponentType);
}

/**
 * children 을 안 줬을 때의 기본 배치 — 도구 줄, 본문, 모바일 줄.
 *
 * 에디터만 띄우는 화면(새 창)을 위한 것이다. 제목 칸이나 발행 단추처럼 글을
 * 둘러싼 것은 여기 없다. 그런 게 필요하면 children 으로 직접 짠다.
 */
function Standalone({
	className,
	placeholder,
	toolbar,
	mobileBar,
	floatingToolbar,
}: {
	className?: string;
	placeholder?: string;
	toolbar?: ComponentType | ReactElement | null;
	mobileBar?: ComponentType | ReactElement | null;
	floatingToolbar: boolean;
}) {
	const shellRef = useRef<HTMLDivElement>(null);

	return (
		<div className="le-shell" ref={shellRef}>
			{slot(toolbar)}
			<Content className={className} placeholder={placeholder} />
			{slot(mobileBar)}
			{floatingToolbar ? <FloatingToolbarPlugin anchorRef={shellRef} /> : null}
		</div>
	);
}

/** 본문 칸. className 으로 앱의 본문 활자(.prose 등)를 입힌다. */
export function Content({
	className,
	placeholder,
}: {
	className?: string;
	placeholder?: string;
}) {
	const [editor] = useLexicalComposerContext();
	const { messages } = useEditorEnv();
	const shellRef = useRef<HTMLDivElement>(null);
	const text = placeholder ?? messages.placeholder;

	// 읽기 전용은 prop 말고 다른 길(handle.lexical().setEditable)로도 바뀐다
	const [editable, setEditable] = useState(() => editor.isEditable());
	useEffect(() => editor.registerEditableListener(setEditable), [editor]);

	return (
		<div className={cx("le-content", editable && "is-editable")} ref={shellRef}>
			<RichTextPlugin
				contentEditable={
					<ContentEditable
						className={cx("editor-input", className)}
						aria-placeholder={placeholderText(text)}
						placeholder={
							<p className="editor-placeholder">
								{placeholderParts(text).map((part, index) =>
									part.key ? (
										// biome-ignore lint/suspicious/noArrayIndexKey: 고정된 문구를 자른 조각이다
										<kbd key={index} className="editor-placeholder-key">
											{part.text}
										</kbd>
									) : (
										part.text
									),
								)}
							</p>
						}
					/>
				}
				ErrorBoundary={LexicalErrorBoundary}
			/>
			{editable ? (
				<>
					<BlockInserterPlugin anchorRef={shellRef} />
					<MediaDropPlugin anchorRef={shellRef} />
					{/* 본문 아래 빈 곳. 누르면 글 끝에서 이어 쓴다 (styles/editor.css 참고) */}
					<div
						className="le-content-tail"
						aria-hidden="true"
						onMouseDown={(event) => {
							event.preventDefault();
							editor.update(() => $placeCaretAtEnd());
							editor.focus();
						}}
					/>
				</>
			) : null}
		</div>
	);
}

function createHandle(
	editor: LexicalEditor,
	store: ReturnType<typeof createPendingMedia> | null,
	messages: EditorMessages,
): EditorHandle {
	return {
		save: async () => {
			const { dropped } = store
				? await uploadPendingMedia(editor, store, messages)
				: { dropped: 0 };
			return { ...readEditorContent(editor), dropped };
		},
		read: () => readEditorContent(editor),
		isEmpty: () =>
			editor.getEditorState().read(() => {
				const root = $getRoot();
				if (root.getTextContent().trim().length > 0) return false;
				/*
				 * 글자가 없어도 사진 · 임베드 · 표 · 구분선만 있는 글이 있다. 노드
				 * 이름을 늘어놓고 세면 새 노드가 생길 때마다 빈 글로 오해하므로,
				 * "빈 문단 하나뿐인가" 로 본다.
				 */
				const children = root.getChildren();
				if (children.length === 0) return true;
				if (children.length > 1) return false;
				const only = children[0];
				if (only.getType() !== "paragraph") return false;
				const size = (only as unknown as { getChildrenSize?: () => number })
					.getChildrenSize;
				return typeof size === "function" ? size.call(only) === 0 : true;
			}),
		/*
		 * 다른 글로 갈아 끼울 때는 앞 글의 흔적을 같이 지운다.
		 *
		 * 되돌리기 이력을 남기면 Cmd+Z 한 번에 앞 글이 이 문서로 돌아오고, 그대로
		 * 자동저장이 돌면 다른 글의 내용이 저장된다. 대기 중인 사진도 앞 글의
		 * 것이라 두면 엉뚱한 글에 올라간다.
		 */
		setContent: (json) => {
			store?.clear();
			editor.setEditorState(editor.parseEditorState(json));
			editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
		},
		clear: () => {
			store?.clear();
			editor.update(
				() => {
					const root = $getRoot();
					root.clear();
					root.append($createParagraphNode());
				},
				// 바로 읽어도 비어 있어야 한다 — 부르는 쪽이 isEmpty() 로 확인한다
				{ discrete: true },
			);
			editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
		},
		focus: () => editor.focus(),
		insertMedia: (items, layout = "sequence") =>
			editor.update(() => $insertMedia(items, layout)),
		lexical: () => editor,
	};
}

/**
 * 읽기 전용 전환. initialConfig 의 editable 은 처음 한 번뿐이라, 뒤에 바뀌면
 * 여기서 Lexical 에 알려 준다.
 */
function EditablePlugin({ editable }: { editable: boolean }) {
	const [editor] = useLexicalComposerContext();
	useEffect(() => {
		if (editor.isEditable() !== editable) editor.setEditable(editable);
	}, [editor, editable]);
	return null;
}

/** 앱에 손잡이를 넘기고, exportDOM 이 쓸 문구를 걸어 둔다. */
function HandlePlugin({ handleRef }: { handleRef?: Ref<EditorHandle> }) {
	const [editor] = useLexicalComposerContext();
	const { media, messages } = useEditorEnv();

	useEffect(() => bindMessages(editor, messages), [editor, messages]);

	useImperativeHandle(handleRef, () => createHandle(editor, media, messages), [
		editor,
		media,
		messages,
	]);
	return null;
}

/**
 * 자동저장 트리거. 예약 규칙은 plugins/autosave.ts 에 있다.
 *
 * 최신 onSave 와 조합 상태를 ref 로 넘겨, 그 값이 바뀌어도 예약이 풀리지 않게
 * 한다 — 의존성이 바뀔 때만 타이머를 걸면 한글 조합이 없는 편집(사진
 * 붙여넣기, 영문 입력)이 자동저장을 못 깨운다.
 */
function AutoSavePlugin({
	onSave,
	delayMs,
}: {
	onSave: (handle: EditorHandle) => void;
	delayMs: number;
}) {
	const [editor] = useLexicalComposerContext();
	const { media, messages } = useEditorEnv();
	const isComposing = useIsComposing();

	const onSaveRef = useRef(onSave);
	onSaveRef.current = onSave;
	const composingRef = useRef(isComposing);
	composingRef.current = isComposing;
	/*
	 * 대기실과 문구도 ref 로 잡는다.
	 *
	 * 의존성에 두면 앱이 문구를 인라인 객체로 넘기는 순간(흔하다) 부모가 다시
	 * 그릴 때마다 예약이 풀린다. 풀 때 기다리던 타이머를 버리므로, 부모가
	 * 자주 그려지는 화면에서는 자동저장이 한 번도 돌지 않는다.
	 */
	const mediaRef = useRef(media);
	mediaRef.current = media;
	const messagesRef = useRef(messages);
	messagesRef.current = messages;

	useEffect(
		() =>
			registerAutoSave(editor, {
				delayMs,
				onSave: (target) =>
					onSaveRef.current(
						createHandle(target, mediaRef.current, messagesRef.current),
					),
				isComposing: () => composingRef.current,
			}),
		[editor, delayMs],
	);

	return null;
}

/**
 * 글자 수 · 읽는 시간. 조합 중에는 세지 않는다 — `안녕`을 치는 동안 숫자가
 * 한 글자마다 튀면 눈이 그리로 끌려간다.
 */
function StatsPlugin({ onStats }: { onStats: (stats: EditorStats) => void }) {
	const [editor] = useLexicalComposerContext();
	const isComposing = useIsComposing();

	/*
	 * onStats 를 의존성에 두면, 앱이 인라인 함수를 넘기고 그 안에서 setState 를
	 * 할 때 이펙트가 다시 돌며 무한 루프가 된다. 최신 값만 ref 로 본다.
	 */
	const onStatsRef = useRef(onStats);
	onStatsRef.current = onStats;
	const composingRef = useRef(isComposing);
	composingRef.current = isComposing;

	useEffect(() => {
		const measure = () => {
			if (composingRef.current) return;
			onStatsRef.current(
				editor
					.getEditorState()
					.read(() => measureText($getRoot().getTextContent())),
			);
		};
		measure();
		return editor.registerUpdateListener(measure);
	}, [editor]);

	return null;
}
