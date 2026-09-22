import type { LexicalEditor } from "lexical";
import { type BlockId, type InsertId, insert, setBlock } from "../actions.ts";
import type { EditorEnv } from "../context.tsx";
import type { EditorMessages } from "../messages/types.ts";
import type { IconName } from "./icons.tsx";

/** / 메뉴와 [+] 메뉴의 한 줄. */
export type MenuItem = {
	id: string;
	label: string;
	hint: string;
	icon: IconName;
	/** / 뒤에 치는 말. 한글과 영문 둘 다로 찾게 한다 — `/제목`, `/h1` */
	keywords: Array<string>;
	/** 구분선처럼 모양을 한 번 더 고르는 것 */
	submenu?: "divider";
	run: (editor: LexicalEditor, env: EditorEnv, anchor: DOMRect | null) => void;
};

const block = (id: BlockId) => (editor: LexicalEditor) => setBlock(editor, id);

const put =
	(id: InsertId) =>
	(editor: LexicalEditor, env: EditorEnv, anchor: DOMRect | null) =>
		void insert(editor, env, id, { anchor });

/** 넣을 수 있는 것. 넣기 줄과 같은 순서다. [+] 메뉴는 이것만 보여 준다. */
export function insertItems(m: EditorMessages): Array<MenuItem> {
	return [
		{
			id: "image",
			label: m.insert.image,
			hint: m.hints.image,
			icon: "image",
			keywords: ["사진", "이미지", "그림", "image", "photo", "picture"],
			run: put("image"),
		},
		{
			id: "imageRow",
			label: m.insert.imageRow,
			hint: m.hints.imageRow,
			icon: "imageRow",
			keywords: [
				"나란히",
				"여러장",
				"갤러리",
				"콜라주",
				"묶음",
				"gallery",
				"row",
				"grid",
			],
			run: put("imageRow"),
		},
		{
			id: "video",
			label: m.insert.video,
			hint: m.hints.video,
			icon: "video",
			keywords: ["영상", "동영상", "비디오", "video", "movie", "mp4"],
			run: put("video"),
		},
		{
			id: "embed",
			label: m.insert.embed,
			hint: m.hints.embed,
			icon: "youtube",
			keywords: ["유튜브", "비메오", "임베드", "youtube", "vimeo", "embed"],
			run: put("embed"),
		},
		{
			id: "quote",
			label: m.insert.quote,
			hint: m.hints.quote,
			icon: "quote",
			keywords: ["인용", "따옴표", "quote", "blockquote"],
			run: put("quote"),
		},
		{
			id: "divider",
			label: m.insert.divider,
			hint: m.hints.divider,
			icon: "minus",
			keywords: ["구분선", "가로선", "hr", "divider", "line"],
			submenu: "divider",
			run: put("divider"),
		},
		{
			id: "code",
			label: m.insert.code,
			hint: m.hints.code,
			icon: "code",
			keywords: ["코드", "코드블록", "code", "snippet"],
			run: put("code"),
		},
		{
			id: "table",
			label: m.insert.table,
			hint: m.hints.table,
			icon: "table",
			keywords: ["표", "테이블", "table", "grid"],
			run: put("table"),
		},
	];
}

/** / 메뉴 전체. 문단 모양이 앞에, 넣을 것이 뒤에. */
export function slashItems(m: EditorMessages): Array<MenuItem> {
	const blocks: Array<MenuItem> = [
		{
			id: "paragraph",
			label: m.blocks.paragraph,
			hint: m.hints.paragraph,
			icon: "type",
			keywords: ["본문", "문단", "text", "paragraph", "p"],
			run: block("paragraph"),
		},
		{
			id: "h1",
			label: m.blocks.h1,
			hint: m.hints.h1,
			icon: "heading1",
			keywords: ["제목", "헤딩", "h1", "heading", "title"],
			run: block("h1"),
		},
		{
			id: "h2",
			label: m.blocks.h2,
			hint: m.hints.h2,
			icon: "heading2",
			keywords: ["제목", "헤딩", "h2", "heading"],
			run: block("h2"),
		},
		{
			id: "h3",
			label: m.blocks.h3,
			hint: m.hints.h3,
			icon: "heading3",
			keywords: ["제목", "헤딩", "h3", "heading"],
			run: block("h3"),
		},
		{
			id: "bulletList",
			label: m.blocks.bulletList,
			hint: m.hints.bulletList,
			icon: "list",
			keywords: ["목록", "리스트", "글머리", "ul", "list", "bullet"],
			run: block("bulletList"),
		},
		{
			id: "numberList",
			label: m.blocks.numberList,
			hint: m.hints.numberList,
			icon: "listOrdered",
			keywords: ["목록", "리스트", "번호", "ol", "ordered", "number"],
			run: block("numberList"),
		},
		{
			id: "checkList",
			label: m.blocks.checkList,
			hint: m.hints.checkList,
			icon: "listChecks",
			keywords: ["체크", "할일", "투두", "todo", "check", "task"],
			run: block("checkList"),
		},
	];
	return [...blocks, ...insertItems(m)];
}

/** / 뒤에 친 말로 거른다. */
export function filterItems(
	items: Array<MenuItem>,
	query: string | null,
): Array<MenuItem> {
	if (!query) return items;
	const needle = query.toLowerCase();
	return items.filter(
		(item) =>
			item.label.toLowerCase().includes(needle) ||
			item.keywords.some((keyword) => keyword.includes(needle)),
	);
}
