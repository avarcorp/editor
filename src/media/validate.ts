import type { EditorMessages } from "../messages/types.ts";
import type { MediaKind } from "./pending-media.ts";

export type MediaLimit = { types: Array<string>; maxBytes: number };
export type MediaLimits = Record<MediaKind, MediaLimit>;

/**
 * 기본 상한. 앱이 서버에서 받는 것과 같은 값을 넘겨 주는 게 맞다 — 여기서
 * 통과했는데 서버가 막으면, 저장을 누른 뒤에야 실패를 안다.
 */
export const DEFAULT_LIMITS: MediaLimits = {
	image: {
		types: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"],
		maxBytes: 10 * 1024 * 1024,
	},
	video: {
		types: ["video/mp4", "video/webm"],
		maxBytes: 100 * 1024 * 1024,
	},
};

const NAMES: Record<string, string> = {
	"image/jpeg": "JPG",
	"image/png": "PNG",
	"image/gif": "GIF",
	"image/webp": "WebP",
	"image/avif": "AVIF",
	"video/mp4": "MP4",
	"video/webm": "WebM",
};

export function formatNames(types: Array<string>): string {
	return types
		.map((type) => NAMES[type] ?? (type.split("/")[1] ?? type).toUpperCase())
		.join(", ");
}

const megabytes = (bytes: number) => Math.round(bytes / 1024 / 1024);

/** 문제가 없으면 null, 있으면 사람에게 보여 줄 문장. */
export function validateMedia(
	file: File,
	kind: MediaKind,
	limits: MediaLimits,
	messages: EditorMessages,
): string | null {
	const limit = limits[kind];
	const text = messages.validate;

	if (kind === "video") {
		/*
		 * .mov 는 따로 말한다. 아이폰이 찍은 .mov 는 대개 HEVC 라 크롬과
		 * 파이어폭스에서 소리만 나거나 아예 안 열린다. 형식 목록만 보여 주면
		 * 왜 안 되는지 모른다.
		 */
		if (file.type === "video/quicktime" && !limit.types.includes(file.type)) {
			return text.videoMov;
		}
		if (!limit.types.includes(file.type)) {
			return text.videoType(formatNames(limit.types));
		}
		if (file.size > limit.maxBytes) {
			return text.videoSize(megabytes(limit.maxBytes));
		}
		return null;
	}

	if (!limit.types.includes(file.type)) {
		return text.imageType(formatNames(limit.types));
	}
	if (file.size > limit.maxBytes) {
		return text.imageSize(megabytes(limit.maxBytes));
	}
	return null;
}
