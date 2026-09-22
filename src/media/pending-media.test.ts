import { describe, expect, it, vi } from "vitest";
import { createPendingMedia, isPreviewSrc } from "./pending-media.ts";

function file(name = "cat.png", type = "image/png") {
	return new File([new Uint8Array(4)], name, { type });
}

describe("isPreviewSrc — 아직 안 올라간 것", () => {
	it("blob: 은 이 브라우저 안에서만 산다", () => {
		expect(isPreviewSrc("blob:http://localhost:3000/abc-123")).toBe(true);
	});

	it("공개 주소는 아니다", () => {
		expect(isPreviewSrc("https://cdn.example.com/a.png")).toBe(false);
		expect(isPreviewSrc("http://cdn.example.com/a.png")).toBe(false);
		expect(isPreviewSrc("/uploads/a.png")).toBe(false);
		expect(isPreviewSrc("")).toBe(false);
	});

	it("data: 도 본문에 넣으면 안 되지만 우리가 만드는 건 blob: 뿐이다", () => {
		expect(isPreviewSrc("data:image/png;base64,AAAA")).toBe(false);
	});
});

describe("createPendingMedia", () => {
	it("담아 두기만 하고 아직 올리지 않는다", () => {
		const upload = vi.fn();
		const store = createPendingMedia({ upload, revoke: vi.fn() });

		store.add("blob:1", file(), "image");

		expect(store.size()).toBe(1);
		expect(store.has("blob:1")).toBe(true);
		expect(upload).not.toHaveBeenCalled();
	});

	it("resolve 해야 그때 올라간다", async () => {
		const upload = vi.fn().mockResolvedValue("https://cdn/x.png");
		const store = createPendingMedia({ upload, revoke: vi.fn() });
		const f = file();
		store.add("blob:1", f, "image");

		await expect(store.resolve("blob:1")).resolves.toBe("https://cdn/x.png");
		expect(upload).toHaveBeenCalledOnce();
		expect(upload.mock.calls[0][0]).toBe(f);
		expect(upload.mock.calls[0][1].kind).toBe("image");
		expect(upload.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
	});

	it("같은 파일을 두 번 올리지 않는다 — 자동저장이 겹쳐도", async () => {
		let settle: (url: string) => void = () => {};
		const upload = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					settle = resolve;
				}),
		);
		const store = createPendingMedia({ upload, revoke: vi.fn() });
		store.add("blob:1", file(), "image");

		const first = store.resolve("blob:1");
		const second = store.resolve("blob:1");
		settle("https://cdn/x.png");

		expect(await first).toBe("https://cdn/x.png");
		expect(await second).toBe("https://cdn/x.png");
		expect(upload).toHaveBeenCalledOnce();
	});

	it("실패하면 다시 올릴 수 있게 남겨 둔다", async () => {
		const upload = vi
			.fn()
			.mockRejectedValueOnce(new Error("연결이 끊겼어요."))
			.mockResolvedValueOnce("https://cdn/x.png");
		const store = createPendingMedia({ upload, revoke: vi.fn() });
		store.add("blob:1", file(), "image");

		await expect(store.resolve("blob:1")).rejects.toThrow("연결이 끊겼어요.");
		expect(store.has("blob:1")).toBe(true);

		await expect(store.resolve("blob:1")).resolves.toBe("https://cdn/x.png");
		expect(upload).toHaveBeenCalledTimes(2);
	});

	it("모르는 주소를 resolve 하면 실패한다", async () => {
		const store = createPendingMedia({ upload: vi.fn(), revoke: vi.fn() });
		await expect(store.resolve("blob:없음")).rejects.toThrow();
	});

	it("forget 은 미리보기 주소를 놓아준다", () => {
		const revoke = vi.fn();
		const store = createPendingMedia({ upload: vi.fn(), revoke });
		store.add("blob:1", file(), "image");

		store.forget("blob:1");

		expect(revoke).toHaveBeenCalledWith("blob:1");
		expect(store.has("blob:1")).toBe(false);
		expect(store.size()).toBe(0);
	});

	it("clear 는 남은 미리보기를 전부 놓아준다 — 화면을 뜰 때", () => {
		const revoke = vi.fn();
		const store = createPendingMedia({ upload: vi.fn(), revoke });
		store.add("blob:1", file(), "image");
		store.add("blob:2", file("clip.mp4", "video/mp4"), "video");

		store.clear();

		expect(revoke).toHaveBeenCalledTimes(2);
		expect(store.size()).toBe(0);
	});

	it("진행률은 부른 쪽으로 그대로 넘어간다", async () => {
		const upload = vi.fn(
			async (
				_f: File,
				{ onProgress }: { onProgress?: (p: number) => void },
			) => {
				onProgress?.(50);
				onProgress?.(100);
				return "https://cdn/clip.mp4";
			},
		);
		const store = createPendingMedia({ upload, revoke: vi.fn() });
		store.add("blob:1", file("clip.mp4", "video/mp4"), "video");

		const seen: Array<number> = [];
		await store.resolve("blob:1", (p) => seen.push(p));

		expect(seen).toEqual([50, 100]);
	});
});

/*
 * 저장은 미리보기를 하나씩 순서대로 올린다. 그 사이에 화면을 뜨면서 clear()
 * 가 아직 차례가 안 온 것까지 지우면, 그 저장은 "올릴 파일을 찾지 못했어요"
 * 로 죽는다 — 마지막 저장 이후에 쓴 글이 통째로 사라진다.
 */
describe("createPendingMedia — 저장 중에 화면을 뜰 때", () => {
	it("올리는 중에는 clear 가 대기실을 비우지 않는다", async () => {
		let settle: (url: string) => void = () => {};
		const upload = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					settle = resolve;
				}),
		);
		const revoke = vi.fn();
		const store = createPendingMedia({ upload, revoke });
		store.add("blob:1", file("one.png"), "image");
		store.add("blob:2", file("two.png"), "image");

		store.beginSave();
		const first = store.resolve("blob:1");

		// 저장이 도는 동안 화면을 떴다
		store.clear();

		expect(store.has("blob:2")).toBe(true);
		settle("https://cdn/one.png");
		await expect(first).resolves.toBe("https://cdn/one.png");
		// 차례가 안 왔던 것이 그대로 남아 있어야 저장이 이어진다
		expect(store.has("blob:2")).toBe(true);
		expect(revoke).not.toHaveBeenCalled();
	});

	it("저장이 끝나면 미뤄 뒀던 정리를 한다", async () => {
		const revoke = vi.fn();
		const store = createPendingMedia({
			upload: async () => "https://cdn/x.png",
			revoke,
		});
		store.add("blob:1", file(), "image");

		store.beginSave();
		store.clear();
		expect(revoke).not.toHaveBeenCalled();

		store.endSave();
		expect(revoke).toHaveBeenCalledWith("blob:1");
		expect(store.size()).toBe(0);
	});

	it("저장 중이 아니면 clear 는 바로 비운다", () => {
		const revoke = vi.fn();
		const store = createPendingMedia({ upload: vi.fn(), revoke });
		store.add("blob:1", file(), "image");

		store.clear();

		expect(revoke).toHaveBeenCalledWith("blob:1");
		expect(store.size()).toBe(0);
	});
});

describe("올리는 중 취소", () => {
	it("본문에서 지우면 요청이 끊긴다", async () => {
		let seen: AbortSignal | null = null;
		const store = createPendingMedia({
			upload: (_file, { signal }) => {
				seen = signal;
				return new Promise<string>(() => {}); // 끝나지 않는 업로드
			},
			revoke: () => {},
		});
		store.add("blob:a", new File(["x"], "a.png"), "image");
		store.resolve("blob:a").catch(() => {});

		expect(seen).not.toBeNull();
		expect((seen as unknown as AbortSignal).aborted).toBe(false);

		store.forget("blob:a");

		expect((seen as unknown as AbortSignal).aborted).toBe(true);
	});

	it("화면을 떠나면 남은 것도 끊는다", () => {
		let seen: AbortSignal | null = null;
		const store = createPendingMedia({
			upload: (_file, { signal }) => {
				seen = signal;
				return new Promise<string>(() => {});
			},
			revoke: () => {},
		});
		store.add("blob:b", new File(["x"], "b.png"), "image");
		store.resolve("blob:b").catch(() => {});
		store.clear();

		expect((seen as unknown as AbortSignal).aborted).toBe(true);
	});
});
