import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { MenuOption } from "@lexical/react/LexicalMenuOption";
import { LexicalTypeaheadMenuPlugin } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { useBasicTypeaheadTriggerMatch } from "@lexical/react/LexicalTypeaheadMenuPluginUtils";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorEnv } from "../context.tsx";
import { Icon } from "../ui/icons.tsx";
import { filterItems, type MenuItem, slashItems } from "../ui/menu-items.ts";

class SlashOption extends MenuOption {
	item: MenuItem;

	constructor(item: MenuItem) {
		super(item.id);
		this.item = item;
	}
}

/** 커서가 있는 자리. 주소를 묻는 창을 여기 붙인다. */
function caretRect(): DOMRect | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return null;
	return selection.getRangeAt(0).getBoundingClientRect();
}

/**
 * `/` 를 치면 뜨는 블록 메뉴 (노션식).
 * 한글 입력 중에도 뜨도록 minLength 를 0 으로 둬서 `/` 만 쳐도 바로 열린다.
 * 목록은 [+] 메뉴 · 넣기 줄과 같은 곳(ui/menu-items.ts)에서 온다.
 */
export function SlashMenuPlugin() {
	const [editor] = useLexicalComposerContext();
	const env = useEditorEnv();
	const [query, setQuery] = useState<string | null>(null);

	// 한글 자모는 punctuation 에 없으니 그대로 검색어로 들어온다.
	const triggerFn = useBasicTypeaheadTriggerMatch("/", { minLength: 0 });

	const allOptions = useMemo(
		() => slashItems(env.messages).map((item) => new SlashOption(item)),
		[env.messages],
	);

	const options = useMemo(() => {
		const visible = new Set(
			filterItems(slashItems(env.messages), query).map((i) => i.id),
		);
		return allOptions.filter((option) => visible.has(option.item.id));
	}, [allOptions, env.messages, query]);

	return (
		<LexicalTypeaheadMenuPlugin<SlashOption>
			onQueryChange={setQuery}
			onSelectOption={(option, nodeToRemove, closeMenu) => {
				const anchor = caretRect();
				editor.update(() => {
					nodeToRemove?.remove();
				});
				option.item.run(editor, env, anchor);
				closeMenu();
			}}
			triggerFn={triggerFn}
			options={options}
			menuRenderFn={(
				anchorRef,
				{ selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
			) => {
				if (!anchorRef.current || options.length === 0) return null;

				return createPortal(
					<div className="le-menu le-slash" id="typeahead-menu" role="listbox">
						{options.map((option, index) => (
							<button
								type="button"
								key={option.key}
								ref={(element) => option.setRefElement(element)}
								role="option"
								aria-selected={selectedIndex === index}
								className="le-menu-item"
								onMouseEnter={() => setHighlightedIndex(index)}
								onClick={() => {
									setHighlightedIndex(index);
									selectOptionAndCleanUp(option);
								}}
							>
								<span className="le-menu-icon">
									<Icon name={option.item.icon} size={16} />
								</span>
								<span className="le-menu-text">
									<span className="le-menu-label">{option.item.label}</span>
									<span className="le-menu-hint">{option.item.hint}</span>
								</span>
							</button>
						))}
					</div>,
					anchorRef.current,
				);
			}}
		/>
	);
}
