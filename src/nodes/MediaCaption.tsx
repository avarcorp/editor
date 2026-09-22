import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 그림·영상 아래 설명.
 *
 * ImageNode 에는 caption 칸과 setCaption 이 처음부터 있었는데 입력할 자리가
 * 없어서 영영 빈 값이었다 — 저장돼도 화면에 안 나오고, 죽은 길이었다.
 *
 * contentEditable 을 쓰지 않고 textarea 를 쓴다. 데코레이터 안에 편집 가능한
 * DOM 을 또 두면 Lexical 의 선택 영역과 서로를 밀어낸다.
 */
export function MediaCaption({
	value,
	placeholder,
	onChange,
}: {
	value: string;
	placeholder: string;
	onChange: (next: string) => void;
}) {
	const [draft, setDraft] = useState(value);
	const ref = useRef<HTMLTextAreaElement>(null);

	// 밖에서 바뀐 값(되돌리기 등)을 따라간다.
	useEffect(() => setDraft(value), [value]);

	const grow = useCallback((element: HTMLTextAreaElement) => {
		element.style.height = "auto";
		element.style.height = `${element.scrollHeight}px`;
	}, []);

	// 처음 붙을 때 한 번 — 저장된 설명이 두 줄이면 두 줄로 펴져야 한다.
	useEffect(() => {
		if (ref.current) grow(ref.current);
	}, [grow]);

	return (
		<textarea
			ref={ref}
			value={draft}
			placeholder={placeholder}
			rows={1}
			spellCheck={false}
			className="editor-media-caption"
			onChange={(event) => {
				setDraft(event.target.value);
				grow(event.currentTarget);
			}}
			// 매 글자마다 에디터 상태를 건드리면 되돌리기 기록이 글자 수만큼 쌓인다.
			onBlur={() => onChange(draft.trim())}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					event.currentTarget.blur();
				}
			}}
		/>
	);
}
