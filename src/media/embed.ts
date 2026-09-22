/**
 * 영상 임베드 주소 해석.
 *
 * 본문 HTML 은 저장된 그대로 독자 화면에 innerHTML 로 꽂힌다. 그래서 여기서
 * 나가는 건 "주소"가 아니라 **제공자 + 검증된 id** 뿐이다. 붙여넣은 URL 을
 * iframe src 에 그대로 넣는 순간 그건 남의 스크립트를 실을 자리가 된다.
 */

export type EmbedProvider = "youtube" | "vimeo";

export type Embed = {
	provider: EmbedProvider;
	/** 제공자별 영상 id. 아래 정규식을 통과한 값만 들어온다. */
	id: string;
};

/** 유튜브 id 는 11자, 비메오는 숫자다. 이 틀을 벗어나면 임베드하지 않는다. */
const YOUTUBE_ID = /^[\w-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

const YOUTUBE_HOSTS = [
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"music.youtube.com",
	"youtu.be",
	"www.youtu.be",
	// 재생기 주소를 그대로 복사해 오는 경우도 받아 준다
	"youtube-nocookie.com",
	"www.youtube-nocookie.com",
];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];

export function parseEmbed(input: string): Embed | null {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		return null;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;

	const host = url.hostname.toLowerCase();
	const parts = url.pathname.split("/").filter(Boolean);

	if (YOUTUBE_HOSTS.includes(host)) {
		// youtu.be/<id> · /watch?v=<id> · /shorts/<id> · /embed/<id> · /live/<id>
		const candidate =
			host.endsWith("youtu.be") && parts.length === 1
				? parts[0]
				: (url.searchParams.get("v") ??
					(["shorts", "embed", "live", "v"].includes(parts[0])
						? parts[1]
						: null));
		if (candidate && YOUTUBE_ID.test(candidate)) {
			return { provider: "youtube", id: candidate };
		}
		return null;
	}

	if (VIMEO_HOSTS.includes(host)) {
		// vimeo.com/<id> · player.vimeo.com/video/<id>
		const candidate = parts[0] === "video" ? parts[1] : parts[0];
		if (candidate && VIMEO_ID.test(candidate)) {
			return { provider: "vimeo", id: candidate };
		}
		return null;
	}

	return null;
}

/*
 * nocookie 도메인은 재생을 누르기 전까지 추적 쿠키를 심지 않는다. 독자가 아무
 * 선택도 하지 않았는데 쿠키부터 받는 건 곤란해서 기본으로 쓴다.
 */
export function embedSrc({ provider, id }: Embed): string {
	return provider === "youtube"
		? `https://www.youtube-nocookie.com/embed/${id}`
		: `https://player.vimeo.com/video/${id}`;
}

/** 원본으로 돌아가는 링크. 임베드가 막힌 환경에서 이것만 남는다. */
export function embedWatchUrl({ provider, id }: Embed): string {
	return provider === "youtube"
		? `https://www.youtube.com/watch?v=${id}`
		: `https://vimeo.com/${id}`;
}

/** 에디터에서 보여줄 미리보기 그림. 비메오는 별도 조회가 필요해 유튜브만 있다. */
export function embedThumbnail({ provider, id }: Embed): string | null {
	return provider === "youtube"
		? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
		: null;
}

export const EMBED_LABEL: Record<EmbedProvider, string> = {
	youtube: "YouTube",
	vimeo: "Vimeo",
};
