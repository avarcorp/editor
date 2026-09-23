/**
 * 에디터 패키지의 바깥 문. 앱은 여기서만 가져온다.
 *
 * 글 HTML 을 거르는 sanitizeHtml 은 서버에서도 쓰므로 React 를 끌고 오지 않게
 * 따로 둔다 — `@avarlabs/editor/sanitize`.
 */
// 가장 먼저 와야 한다. 다른 import 가 Prism 언어 파일을 끌고 오기 전에 코어를 전역에 올린다
import "./prism-global.ts";

export {
	type BlockId,
	type InsertId,
	insert,
	normalizeUrl,
	setBlock,
} from "./actions.ts";
export { useEditorEnv, useMessages } from "./context.tsx";
export {
	Content,
	Editor,
	type EditorHandle,
	type EditorProps,
	type MediaAdapter,
} from "./Editor.tsx";
export { type EditorContent, readEditorContent } from "./format/serialize.ts";
export { type EditorStats, measureText } from "./format/stats.ts";
export { TRANSFORMERS } from "./format/transformers.ts";
export { type Embed, parseEmbed } from "./media/embed.ts";
export {
	$insertMedia,
	canLayoutAsRow,
	type MediaLayout,
	type MediaRef,
} from "./media/library.ts";
export { listMediaSrcs } from "./media/media-upload.ts";
export {
	type MediaKind,
	MissingFileError,
	UploadError,
	type UploadFile,
	type UploadOptions,
	type UploadProgress,
} from "./media/pending-media.ts";
export {
	DEFAULT_LIMITS,
	type MediaLimit,
	type MediaLimits,
} from "./media/validate.ts";
export { en } from "./messages/en.ts";
export { ko } from "./messages/ko.ts";
export type { EditorMessages } from "./messages/types.ts";
export {
	$createDividerNode,
	$isDividerNode,
	DIVIDER_VARIANTS,
	DividerNode,
	type DividerVariant,
	INSERT_DIVIDER_COMMAND,
} from "./nodes/DividerNode.tsx";
export { editorNodes } from "./nodes/index.ts";
export { FloatingToolbarPlugin as FloatingToolbar } from "./plugins/FloatingToolbarPlugin.tsx";
export {
	MEDIA_DRAG_TYPE,
	setMediaDragData,
} from "./plugins/MediaDropPlugin.tsx";
export { editorTheme } from "./theme.ts";
export {
	EditorMobileBar,
	MobileBar,
	type MobilePanel,
} from "./ui/MobileBar.tsx";
export {
	EditorToolbar,
	FormatRow,
	InsertButton,
	InsertRow,
	Toolbar,
} from "./ui/Toolbar.tsx";
