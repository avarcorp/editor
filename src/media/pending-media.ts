/**
 * 아직 안 올라간 그림·영상을 붙잡아 두는 자리.
 *
 * 붙이는 순간 올리지 않는다. 붙여 놓고 마음이 바뀌어 지우는 일이 흔한데,
 * 그때마다 CDN 에 주인 없는 파일이 남기 때문이다. 대신 blob: 미리보기를
 * 본문에 먼저 넣어 두고, 저장할 때 한꺼번에 올린 뒤 주소를 바꿔 끼운다.
 *
 * Lexical 도 React 도 모른다 — 여기 있는 건 "주소 → 파일" 뿐이다.
 */

export type MediaKind = "image" | "video";

/**
 * 사람에게 보여 줄 문장을 실은 업로드 실패.
 *
 * 올리는 함수(앱이 넘긴다)가 이걸 던지면 그 문장이 그대로 화면에 나간다.
 * 다른 오류는 내부 사정이라 보여 주지 않고 "파일을 올리지 못했어요" 로 덮는다 —
 * `Failed to fetch` 같은 영문이 글쓴이 화면에 뜨면 아무 도움이 안 된다.
 */
export class UploadError extends Error {
	override name = "UploadError";
}

/** 맡겨 둔 파일이 없다. 새로고침하면 대기실이 빈다. */
export class MissingFileError extends Error {
	override name = "MissingFileError";
}

export type UploadProgress = (percent: number) => void;

export type UploadOptions = {
	kind: MediaKind;
	/**
	 * 이 파일이 더 이상 필요 없을 때 끊긴다 — 본문에서 지웠거나 화면을 떠났을 때.
	 * fetch 에 그대로 넘기면 된다. 끊긴 요청의 실패는 화면에 띄우지 않는다.
	 */
	signal: AbortSignal;
	onProgress?: UploadProgress;
};

export type UploadFile = (
	file: File,
	options: UploadOptions,
) => Promise<string>;

/** 이 브라우저 안에서만 사는 주소인가. 본문에 이대로 저장되면 남들에겐 깨진 그림이다. */
export function isPreviewSrc(src: string): boolean {
	return src.startsWith("blob:");
}

type Entry = {
	file: File;
	kind: MediaKind;
	/** 올리는 중이면 그 약속. 자동저장과 발행이 겹쳐도 두 번 올리지 않는다. */
	inFlight?: Promise<string>;
	/** 올리는 중에 이 항목이 사라지면 요청도 끊는다. */
	abort?: AbortController;
};

export type PendingMedia = ReturnType<typeof createPendingMedia>;

export function createPendingMedia({
	upload,
	revoke = URL.revokeObjectURL,
}: {
	upload: UploadFile;
	revoke?: (url: string) => void;
}) {
	const entries = new Map<string, Entry>();
	/*
	 * 이미 올린 것의 주소를 기억해 둔다.
	 *
	 * 되돌리기나 되살리기로 본문에 옛 blob: 주소가 돌아올 수 있다. 그때 "올릴
	 * 파일이 없다"고 던지면 그 뒤로 저장이 통째로 막힌다 — 사람이 쓰는 글이
	 * 하나도 안 저장된다. 아는 주소면 다시 올리지 않고 바로 답한다.
	 */
	const uploaded = new Map<string, string>();

	/*
	 * 저장이 도는 동안에는 대기실을 비우지 않는다.
	 *
	 * 저장은 미리보기를 하나씩 순서대로 올린다. 그 사이에 화면을 떠서 clear()
	 * 가 아직 차례가 안 온 것까지 지우면, 그 저장이 "올릴 파일을 찾지 못했어요"
	 * 로 죽고 마지막 저장 이후에 쓴 글이 통째로 사라진다.
	 */
	let saving = 0;
	let clearPending = false;

	const flush = () => {
		for (const [url, entry] of entries) {
			// 화면을 떠났다. 올리는 중이던 것도 끊는다 — 아무도 그 주소를 기다리지 않는다.
			entry.abort?.abort();
			revoke(url);
		}
		entries.clear();
		uploaded.clear();
	};

	return {
		/** 저장이 시작됐다. 끝날 때까지 정리를 미룬다. */
		beginSave(): void {
			saving += 1;
		},

		endSave(): void {
			saving = Math.max(0, saving - 1);
			if (saving === 0 && clearPending) {
				clearPending = false;
				flush();
			}
		},

		add(previewUrl: string, file: File, kind: MediaKind): void {
			entries.set(previewUrl, { file, kind });
		},

		has(previewUrl: string): boolean {
			return entries.has(previewUrl);
		},

		/**
		 * 이 미리보기를 공개 주소로 바꿀 길이 있나 — 파일이 아직 있거나, 이미
		 * 올려서 주소를 알거나. 둘 다 아니면 되살릴 수 없다 (새로고침 뒤 등).
		 */
		knows(previewUrl: string): boolean {
			return entries.has(previewUrl) || uploaded.has(previewUrl);
		},

		size(): number {
			return entries.size;
		},

		/**
		 * 올리고 공개 주소를 돌려준다.
		 *
		 * 실패해도 자리에서 지우지 않는다 — 미리보기는 화면에 그대로 남아야
		 * 다시 저장을 눌러 재시도할 수 있다.
		 */
		resolve(previewUrl: string, onProgress?: UploadProgress): Promise<string> {
			const known = uploaded.get(previewUrl);
			if (known) return Promise.resolve(known);

			const entry = entries.get(previewUrl);
			if (!entry) {
				return Promise.reject(new MissingFileError(previewUrl));
			}
			if (entry.inFlight) return entry.inFlight;

			const abort = new AbortController();
			entry.abort = abort;
			const promise = upload(entry.file, {
				kind: entry.kind,
				signal: abort.signal,
				onProgress,
			})
				.then((url) => {
					uploaded.set(previewUrl, url);
					return url;
				})
				.catch((error: unknown) => {
					entry.inFlight = undefined;
					throw error;
				});
			entry.inFlight = promise;
			return promise;
		},

		/** 다 쓴 미리보기 주소를 놓아준다. 올리는 중이었으면 요청도 끊는다. */
		forget(previewUrl: string): void {
			const entry = entries.get(previewUrl);
			if (!entries.delete(previewUrl)) return;
			// 이미 주소를 받아 둔 것은 끊을 게 없다 (uploaded 에 남는다)
			if (!uploaded.has(previewUrl)) entry?.abort?.abort();
			revoke(previewUrl);
		},

		/** 화면을 뜰 때. 남은 미리보기를 전부 놓아준다. */
		clear(): void {
			if (saving > 0) {
				clearPending = true;
				return;
			}
			flush();
		},
	};
}
