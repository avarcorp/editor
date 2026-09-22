import { useCallback, useEffect, useRef, useState } from "react";
import { type UrlRequest, useMessages } from "../context.tsx";
import { Popover } from "./Popover.tsx";

type Pending = UrlRequest & { resolve: (value: string | null) => void };

/**
 * 주소 한 줄을 묻는 창. 링크와 유튜브가 쓴다.
 *
 * window.prompt 를 쓰지 않는다 — 모바일에서 화면을 통째로 가리고, 모양을
 * 맞출 수 없고, 한 번 막히면 페이지가 멈춘다.
 */
export function useUrlPrompt() {
	const [pending, setPending] = useState<Pending | null>(null);
	const pendingRef = useRef<Pending | null>(null);
	pendingRef.current = pending;

	const askUrl = useCallback(
		(request: UrlRequest) =>
			new Promise<string | null>((resolve) => {
				// 이미 떠 있던 창은 취소로 닫는다
				pendingRef.current?.resolve(null);
				setPending({ ...request, resolve });
			}),
		[],
	);

	const finish = useCallback((value: string | null) => {
		pendingRef.current?.resolve(value);
		setPending(null);
	}, []);

	const host = <UrlPromptView pending={pending} onFinish={finish} />;
	return { askUrl, host };
}

function UrlPromptView({
	pending,
	onFinish,
}: {
	pending: Pending | null;
	onFinish: (value: string | null) => void;
}) {
	const m = useMessages();
	const [value, setValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!pending) return;
		setValue("");
		// 창이 자리를 잡은 다음 칸에 커서를 둔다
		const id = requestAnimationFrame(() => inputRef.current?.focus());
		return () => cancelAnimationFrame(id);
	}, [pending]);

	const anchorRect =
		pending?.anchor ??
		(typeof window === "undefined"
			? null
			: new DOMRect(window.innerWidth / 2 - 150, 120, 300, 0));

	return (
		<Popover
			open={pending !== null}
			anchorRect={anchorRect}
			onClose={() => onFinish(null)}
			placement="bottom-center"
			className="le-url"
			label={pending?.kind === "embed" ? m.insert.embed : m.insert.link}
		>
			{/*
				브라우저 검사를 끈다. type="url" 은 https:// 가 없으면 넣기를 말없이 막는데,
				앞머리는 우리가 붙인다 (actions.ts normalizeUrl) — loggy.page 도 받는다.
			*/}
			<form
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					onFinish(value.trim() || null);
				}}
			>
				<input
					ref={inputRef}
					type="url"
					inputMode="url"
					autoCapitalize="off"
					autoCorrect="off"
					spellCheck={false}
					value={value}
					onChange={(event) => setValue(event.target.value)}
					placeholder={
						pending?.kind === "embed"
							? m.url.embedPlaceholder
							: m.url.linkPlaceholder
					}
				/>
				<button
					type="button"
					className="le-url-cancel"
					onClick={() => onFinish(null)}
				>
					{m.url.cancel}
				</button>
				<button type="submit" className="le-url-apply" disabled={!value.trim()}>
					{m.url.apply}
				</button>
			</form>
		</Popover>
	);
}
