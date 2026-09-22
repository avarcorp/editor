import { describe, expect, it } from "vitest";
import {
	embedSrc,
	embedThumbnail,
	embedWatchUrl,
	parseEmbed,
} from "./embed.ts";

/*
 * 본문 HTML 은 저장된 그대로 독자 화면에 꽂힌다. 붙여넣은 주소를 iframe src 에
 * 그대로 넣으면 그 자리가 남의 스크립트 자리가 된다. 그래서 여기서 나가는 건
 * 주소가 아니라 제공자 + 검증된 id 뿐이다.
 */
describe("parseEmbed — 유튜브", () => {
	const ID = "dQw4w9WgXcQ";

	it("주소 모양을 두루 받는다", () => {
		for (const url of [
			`https://www.youtube.com/watch?v=${ID}`,
			`https://youtube.com/watch?v=${ID}&t=42s`,
			`https://m.youtube.com/watch?v=${ID}`,
			`https://music.youtube.com/watch?v=${ID}`,
			`https://youtu.be/${ID}`,
			`https://youtu.be/${ID}?t=42`,
			`https://www.youtube.com/shorts/${ID}`,
			`https://www.youtube.com/embed/${ID}`,
			`https://www.youtube.com/live/${ID}`,
			`https://www.youtube-nocookie.com/embed/${ID}`,
		]) {
			expect(parseEmbed(url), url).toEqual({ provider: "youtube", id: ID });
		}
	});

	it("앞뒤 공백은 무시한다", () => {
		expect(parseEmbed(`  https://youtu.be/${ID}  `)).toEqual({
			provider: "youtube",
			id: ID,
		});
	});

	it("id 가 11자 틀을 벗어나면 임베드하지 않는다", () => {
		expect(parseEmbed("https://www.youtube.com/watch?v=short")).toBeNull();
		expect(
			parseEmbed("https://www.youtube.com/watch?v=way-too-long-id-here"),
		).toBeNull();
		expect(
			parseEmbed('https://www.youtube.com/watch?v="><script>alert(1)</script>'),
		).toBeNull();
	});

	it("유튜브가 아닌 경로는 안 받는다", () => {
		expect(parseEmbed("https://www.youtube.com/@someone")).toBeNull();
		expect(parseEmbed("https://www.youtube.com/")).toBeNull();
	});
});

describe("parseEmbed — 비메오", () => {
	it("주소 두 모양을 받는다", () => {
		expect(parseEmbed("https://vimeo.com/123456789")).toEqual({
			provider: "vimeo",
			id: "123456789",
		});
		expect(parseEmbed("https://player.vimeo.com/video/123456789")).toEqual({
			provider: "vimeo",
			id: "123456789",
		});
	});

	it("숫자가 아니면 안 받는다", () => {
		expect(parseEmbed("https://vimeo.com/channels/staffpicks")).toBeNull();
	});
});

describe("parseEmbed — 막는 것", () => {
	it("모르는 제공자는 안 받는다", () => {
		expect(parseEmbed("https://evil.example/embed/xyz")).toBeNull();
		expect(parseEmbed("https://vimeo.com.evil.example/123456789")).toBeNull();
		expect(parseEmbed("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
	});

	it("http·https 가 아닌 스킴은 안 받는다", () => {
		expect(parseEmbed("javascript:alert(1)")).toBeNull();
		expect(parseEmbed("data:text/html,<script>alert(1)</script>")).toBeNull();
	});

	it("주소가 아니면 안 받는다", () => {
		expect(parseEmbed("")).toBeNull();
		expect(parseEmbed("그냥 글자")).toBeNull();
	});
});

describe("만들어 내는 주소", () => {
	const embed = { provider: "youtube", id: "dQw4w9WgXcQ" } as const;

	it("재생기는 쿠키를 안 심는 도메인을 쓴다", () => {
		expect(embedSrc(embed)).toBe(
			"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
		);
	});

	it("임베드가 막힌 환경에는 원본 링크가 남는다", () => {
		expect(embedWatchUrl(embed)).toBe(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
		expect(embedWatchUrl({ provider: "vimeo", id: "123456789" })).toBe(
			"https://vimeo.com/123456789",
		);
	});

	it("비메오 미리보기는 별도 조회가 필요해 없다", () => {
		expect(embedThumbnail(embed)).toContain("dQw4w9WgXcQ");
		expect(embedThumbnail({ provider: "vimeo", id: "123456789" })).toBeNull();
	});

	it("만들어 낸 주소는 파싱한 값만으로 이뤄진다", () => {
		// id 는 이미 정규식을 통과한 값이라 주소 조립이 안전하다
		const parsed = parseEmbed("https://youtu.be/dQw4w9WgXcQ");
		expect(parsed).not.toBeNull();
		expect(embedSrc(parsed as never)).not.toContain("?");
	});
});
