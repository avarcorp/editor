import { describe, expect, it } from "vitest";
import { ko } from "../messages/ko.ts";
import { DEFAULT_LIMITS, formatNames, validateMedia } from "./validate.ts";

const file = (type: string, size = 1024) =>
	new File([new Uint8Array(size)], "f", { type });

describe("validateMedia — 올리기 전에 거른다", () => {
	it("받는 형식이면 통과한다", () => {
		expect(validateMedia(file("image/png"), "image", DEFAULT_LIMITS, ko)).toBe(
			null,
		);
		expect(validateMedia(file("video/mp4"), "video", DEFAULT_LIMITS, ko)).toBe(
			null,
		);
	});

	it("형식이 틀리면 받는 형식을 이름으로 알려 준다", () => {
		expect(
			validateMedia(file("image/svg+xml"), "image", DEFAULT_LIMITS, ko),
		).toBe("JPG, PNG, GIF, WebP, AVIF 이미지만 올릴 수 있습니다.");
	});

	it("너무 크면 상한을 MB 로 알려 준다", () => {
		const limits = {
			...DEFAULT_LIMITS,
			image: { ...DEFAULT_LIMITS.image, maxBytes: 1024 * 1024 },
		};
		expect(
			validateMedia(file("image/png", 2 * 1024 * 1024), "image", limits, ko),
		).toBe("이미지는 1MB까지 올릴 수 있습니다.");
	});

	it("MOV 는 따로 이유를 말한다 — 대개 HEVC 라 브라우저마다 갈린다", () => {
		expect(
			validateMedia(file("video/quicktime"), "video", DEFAULT_LIMITS, ko),
		).toBe(ko.validate.videoMov);
	});

	it("앱이 상한을 바꿔 줄 수 있다", () => {
		const limits = {
			...DEFAULT_LIMITS,
			video: { types: ["video/webm"], maxBytes: 5 },
		};
		expect(validateMedia(file("video/mp4", 1), "video", limits, ko)).toBe(
			"WebM 영상만 올릴 수 있습니다.",
		);
	});
});

describe("formatNames", () => {
	it("MIME 을 사람이 아는 이름으로 바꾼다", () => {
		expect(formatNames(["image/jpeg", "image/webp", "video/mp4"])).toBe(
			"JPG, WebP, MP4",
		);
	});

	it("모르는 형식은 뒤쪽을 대문자로 쓴다", () => {
		expect(formatNames(["image/heic"])).toBe("HEIC");
	});
});
