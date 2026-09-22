import { $createCodeNode } from "@lexical/code";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createQuoteNode } from "@lexical/rich-text";
import { $createTableNodeWithDimensions } from "@lexical/table";
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	$getSelection,
	$isRangeSelection,
	createEditor,
	ElementNode,
	type Klass,
	type LexicalEditor,
	type LexicalNode,
} from "lexical";
import { describe, expect, it } from "vitest";
import { $createDividerNode } from "../nodes/DividerNode.tsx";
import { $createImageNode } from "../nodes/ImageNode.tsx";
import { editorNodes } from "../nodes/index.ts";
import { editorTheme } from "../theme.ts";
import {
	$placeCaretAtEnd,
	focusEditor,
	followDistance,
	isTypingUpdate,
} from "./caret-follow.ts";

const tags = (...names: Array<string>) => new Set(names);
const dirty = (size: number) =>
	new Map(Array.from({ length: size }, (_, i) => [String(i), true]));

describe("isTypingUpdate — 커서를 따라갈 업데이트", () => {
	it("글자를 치면 따라간다", () => {
		expect(
			isTypingUpdate({
				dirtyElements: dirty(1),
				dirtyLeaves: new Set(["a"]),
				tags: tags(),
			}),
		).toBe(true);
	});

	it("커서만 옮긴 것(포커스 · 클릭)은 따라가지 않는다", () => {
		expect(
			isTypingUpdate({
				dirtyElements: dirty(0),
				dirtyLeaves: new Set(),
				tags: tags(),
			}),
		).toBe(false);
	});

	it("저장이 스스로 건 편집(사진 주소 교체)은 따라가지 않는다", () => {
		expect(
			isTypingUpdate({
				dirtyElements: dirty(1),
				dirtyLeaves: new Set(["a"]),
				tags: tags("media-upload", "history-merge"),
			}),
		).toBe(false);
	});

	it("플러그인이 붙으며 거는 편집(history-merge)도 따라가지 않는다", () => {
		expect(
			isTypingUpdate({
				dirtyElements: dirty(2),
				dirtyLeaves: new Set(),
				tags: tags("history-merge"),
			}),
		).toBe(false);
	});
});

describe("followDistance — 아래로 얼마나 내릴까", () => {
	it("커서 아래로 여유가 있으면 움직이지 않는다", () => {
		expect(followDistance({ bottom: 500 }, 700, 32)).toBe(0);
	});

	it("여유 안으로 들어오면 여유만큼 내린다", () => {
		expect(followDistance({ bottom: 690 }, 700, 32)).toBe(22);
	});

	it("가려진 만큼 더 내린다 (모바일 도구 줄 뒤로 숨은 경우)", () => {
		expect(followDistance({ bottom: 700 }, 652, 32)).toBe(80);
	});

	it("위로는 올리지 않는다 — 입력 중에만 아래로 따라간다", () => {
		expect(followDistance({ bottom: -40 }, 700, 32)).toBe(0);
	});
});

/**
 * 표가 아닌 shadow root. 앱이 붙인 격자형 커스텀 노드 자리다 — 이름(표)이 아니라
 * isShadowRoot() 로 묻는지 가른다.
 */
class ShadowBlockNode extends ElementNode {
	static getType(): string {
		return "shadow-block";
	}
	static clone(node: ShadowBlockNode): ShadowBlockNode {
		return new ShadowBlockNode(node.__key);
	}
	createDOM(): HTMLElement {
		throw new Error("그리지 않는다 — 트리만 쓰는 테스트다");
	}
	updateDOM(): boolean {
		return false;
	}
	isShadowRoot(): boolean {
		return true;
	}
}

function makeEditor(extra: Array<Klass<LexicalNode>> = []): LexicalEditor {
	return createEditor({
		namespace: "test",
		nodes: [...editorNodes, ...extra],
		theme: editorTheme,
		onError: (error) => {
			throw error;
		},
	});
}

function caretIn(editor: LexicalEditor) {
	return editor.getEditorState().read(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
		const node = selection.anchor.getNode();
		const top = node.getTopLevelElementOrThrow();
		return {
			index: $getRoot().getChildren().indexOf(top),
			type: top.getType(),
			atEnd: selection.anchor.offset === (node.getTextContentSize?.() ?? 0),
		};
	});
}

describe("$placeCaretAtEnd — 본문 아래 빈 곳을 눌렀을 때", () => {
	it("마지막 문단의 끝에 커서를 둔다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append(
					$createParagraphNode().append($createTextNode("첫 줄")),
					$createParagraphNode().append($createTextNode("끝 줄")),
				);
				$placeCaretAtEnd();
			},
			{ discrete: true },
		);
		expect(caretIn(editor)).toEqual({
			index: 1,
			type: "paragraph",
			atEnd: true,
		});
	});

	it("마지막이 사진이면 그 아래에 새 문단을 만든다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append(
					$createParagraphNode().append($createTextNode("글")),
					$createImageNode({ src: "https://cdn.test/a.png" }),
				);
				$placeCaretAtEnd();
			},
			{ discrete: true },
		);
		expect(caretIn(editor)).toEqual({
			index: 2,
			type: "paragraph",
			atEnd: true,
		});
	});

	it("마지막이 구분선이어도 새 문단을 만든다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append($createDividerNode("line"));
				$placeCaretAtEnd();
			},
			{ discrete: true },
		);
		expect(caretIn(editor)).toEqual({
			index: 1,
			type: "paragraph",
			atEnd: true,
		});
	});

	it("마지막이 코드블록이면 그 아래에 새 문단을 만든다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append(
					$createParagraphNode().append($createTextNode("예제를 보자")),
					$createCodeNode().append($createTextNode("const a = 1;")),
				);
				$placeCaretAtEnd();
			},
			{ discrete: true },
		);
		// 코드블록 안에서는 Enter 가 줄바꿈이라 빠져나올 길이 없다
		expect(caretIn(editor)).toEqual({
			index: 2,
			type: "paragraph",
			atEnd: true,
		});
	});

	it("마지막이 표여도 새 문단을 만든다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append(
					$createParagraphNode().append($createTextNode("표")),
					$createTableNodeWithDimensions(1, 1, false),
				);
				$placeCaretAtEnd();
			},
			{ discrete: true },
		);
		expect(caretIn(editor)).toEqual({
			index: 2,
			type: "paragraph",
			atEnd: true,
		});
	});

	it("마지막이 인용구면 그 안에서 이어 쓴다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append($createQuoteNode().append($createTextNode("인용")));
				$placeCaretAtEnd();
			},
			{ discrete: true },
		);
		// Enter 두 번이면 빠져나온다 — 빈 문단을 덧붙일 이유가 없다
		expect(caretIn(editor)).toEqual({ index: 0, type: "quote", atEnd: true });
	});

	it("마지막이 목록이면 마지막 항목에서 이어 쓴다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				const list = $createListNode("bullet");
				list.append(
					$createListItemNode().append($createTextNode("하나")),
					$createListItemNode().append($createTextNode("둘")),
				);
				$getRoot().append(list);
				$placeCaretAtEnd();
			},
			{ discrete: true },
		);
		expect(caretIn(editor)).toEqual({ index: 0, type: "list", atEnd: true });
	});

	it("표가 아니어도 안이 따로 노는 블록이면 새 문단을 만든다", () => {
		const editor = makeEditor([ShadowBlockNode]);
		editor.update(
			() => {
				const block = new ShadowBlockNode();
				block.append($createParagraphNode().append($createTextNode("칸")));
				$getRoot().append(block);
				$placeCaretAtEnd();
			},
			{ discrete: true },
		);
		expect(caretIn(editor)).toEqual({
			index: 1,
			type: "paragraph",
			atEnd: true,
		});
	});

	it("빈 문서면 문단을 하나 만든다", () => {
		const editor = makeEditor();
		editor.update(() => $placeCaretAtEnd(), { discrete: true });
		expect(caretIn(editor)).toEqual({
			index: 0,
			type: "paragraph",
			atEnd: true,
		});
	});
});

describe("focusEditor — 본문에 포커스를 줄 때", () => {
	it("커서가 없고 코드블록으로 끝나면 그 아래 문단에 둔다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				$getRoot().append(
					$createParagraphNode().append($createTextNode("설치")),
					$createCodeNode().append($createTextNode("pnpm add x")),
				);
			},
			{ discrete: true },
		);
		focusEditor(editor);
		expect(caretIn(editor)).toEqual({
			index: 2,
			type: "paragraph",
			atEnd: true,
		});
	});

	it("커서가 이미 있으면 건드리지 않는다", () => {
		const editor = makeEditor();
		editor.update(
			() => {
				const first = $createParagraphNode().append($createTextNode("첫 줄"));
				$getRoot().append(
					first,
					$createCodeNode().append($createTextNode("pnpm add x")),
				);
				first.selectEnd();
			},
			{ discrete: true },
		);
		focusEditor(editor);
		// 앱이 포커스를 돌려줄 때마다 커서가 글 끝으로 튀면 쓰던 자리를 잃는다
		expect(caretIn(editor)).toEqual({
			index: 0,
			type: "paragraph",
			atEnd: true,
		});
		expect(
			editor.getEditorState().read(() => $getRoot().getChildrenSize()),
		).toBe(2);
	});
});
