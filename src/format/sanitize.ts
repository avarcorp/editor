import { FilterXSS } from "xss";

/**
 * 저장된 글 HTML 을 독자 화면에 꽂기 전에 거른다.
 *
 * 글 HTML 은 브라우저가 만들어 보낸다 (워커에는 DOM 이 없어서 서버가 다시
 * 못 만든다). 그러니 서버가 받는 건 "에디터가 만들었을 것" 이지 에디터가 만든
 * 것이 아니다 — 요청을 손으로 짜면 <script> 든 onerror 든 넣을 수 있고, 그 글을
 * 여는 독자의 브라우저에서 돈다.
 *
 * 그래서 에디터가 실제로 내는 모양만 허용 목록으로 둔다. 새 노드를 만들면
 * 여기에도 적어야 독자 화면에 나온다 (sanitize.test.ts 가 그걸 잡는다).
 * DOM 없이 도는 문자열 파서라 워커에서도 쓴다.
 */

const CLASS_TOKEN =
	/^(editor-[a-zA-Z0-9-]+|image-row|image-row-track|embed|embed-frame|divider)$/;

/** 재생기로 받아 주는 주소. EmbedNode 가 조립하는 모양 그대로다. */
const PLAYER_SRC = [
	/^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/,
	/^https:\/\/player\.vimeo\.com\/video\/\d{6,12}$/,
];

/** 인라인 스타일로 받아 주는 것. 값까지 모양을 본다. */
const STYLE: Record<string, RegExp> = {
	"text-align": /^(left|center|right|justify|start|end)$/,
	"white-space": /^pre-wrap$/,
	// 사진 줄의 폭 몫 (ImageRowNode.exportDOM)
	flex: /^\d+(\.\d+)? 1 0%$/,
	// 들여쓰기
	"padding-inline-start":
		/^(\d+(\.\d+)?(px|em|rem)|calc\(\d+ \* \d+(\.\d+)?(px|em|rem)\))$/,
};

const COMMON = ["class", "style", "dir"];

const ALLOWED: Record<string, Array<string>> = {
	h1: COMMON,
	h2: COMMON,
	h3: COMMON,
	h4: COMMON,
	h5: COMMON,
	h6: COMMON,
	p: COMMON,
	span: COMMON,
	b: COMMON,
	strong: COMMON,
	i: COMMON,
	em: COMMON,
	u: COMMON,
	s: COMMON,
	sub: COMMON,
	sup: COMMON,
	mark: COMMON,
	code: [...COMMON, "spellcheck"],
	br: [],
	blockquote: COMMON,
	ul: COMMON,
	ol: [...COMMON, "start"],
	li: [...COMMON, "value", "role", "aria-checked"],
	pre: [...COMMON, "spellcheck", "data-language", "data-highlight-language"],
	a: ["class", "href", "rel", "target", "title"],
	figure: ["class", "data-count"],
	figcaption: ["class"],
	div: ["class"],
	img: ["class", "src", "alt", "loading", "width", "height", "style"],
	video: ["src", "controls", "playsinline", "preload"],
	iframe: [
		"src",
		"title",
		"loading",
		"allowfullscreen",
		"allow",
		"referrerpolicy",
	],
	hr: ["class", "data-variant"],
	table: COMMON,
	colgroup: [],
	col: [],
	thead: [],
	tbody: [],
	tr: COMMON,
	th: [...COMMON, "colspan", "rowspan"],
	td: [...COMMON, "colspan", "rowspan"],
};

/** 값이 없는 속성 (controls 등). 원래 모양대로 `name=""` 로 둔다. */
const BOOLEAN = new Set(["controls", "playsinline", "allowfullscreen"]);

const ENUMS: Record<string, RegExp> = {
	target: /^_blank$/,
	loading: /^lazy$/,
	preload: /^(metadata|none)$/,
	role: /^checkbox$/,
	"aria-checked": /^(true|false)$/,
	spellcheck: /^false$/,
	dir: /^(ltr|rtl|auto)$/,
	referrerpolicy: /^strict-origin-when-cross-origin$/,
	"data-variant": /^(line|short|bold|dots|diamond)$/,
	allow: /^[a-z-]+(; [a-z-]+)*$/,
};

const NUMERIC = new Set([
	"width",
	"height",
	"value",
	"start",
	"colspan",
	"rowspan",
	"data-count",
]);

/*
 * xss 의 도우미(escapeAttrValue 등)는 쓰지 않는다. 그 패키지는 CommonJS 라
 * 도우미를 반복문으로 붙이는데, Node 의 ESM 은 그런 이름을 못 찾는다
 * (FilterXSS 만 보인다). 필요한 건 둘뿐이라 여기 둔다.
 */

const NAMED: Record<string, string> = {
	amp: "&",
	quot: '"',
	apos: "'",
	lt: "<",
	gt: ">",
	nbsp: "\u00a0",
	colon: ":",
	tab: "\t",
	newline: "\n",
};

/** 속성 값을 글자로 푼다. 엔티티로 감춘 `javascript:` 를 드러내려는 것. */
function decodeAttr(value: string): string {
	return value.replace(
		/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi,
		(match, body: string) => {
			if (body[0] === "#") {
				const code =
					body[1] === "x" || body[1] === "X"
						? Number.parseInt(body.slice(2), 16)
						: Number.parseInt(body.slice(1), 10);
				return Number.isFinite(code) && code <= 0x10ffff
					? String.fromCodePoint(code)
					: "";
			}
			return NAMED[body.toLowerCase()] ?? match;
		},
	);
}

/** 주소를 볼 때는 브라우저가 무시하는 제어 문자(탭 · 줄바꿈 등)까지 걷어 낸다. */
const bareUrl = (value: string) =>
	// biome-ignore lint/suspicious/noControlCharactersInRegex: 제어 문자를 걷어 내려는 것
	decodeAttr(value).replace(/[\u0000-\u0020\u007f]/g, "");

const escapeAttr = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

const attr = (name: string, value: string) => `${name}="${escapeAttr(value)}"`;

function cleanUrl(value: string, schemes: Array<string>): string | null {
	const url = decodeAttr(value).trim();
	const lower = bareUrl(value).toLowerCase();
	return schemes.some((scheme) => lower.startsWith(scheme)) ? url : null;
}

function cleanStyle(value: string): string {
	const raw = decodeAttr(value);
	const kept = raw
		.split(";")
		.map((part) => part.trim())
		.filter((part) => {
			const colon = part.indexOf(":");
			if (colon < 0) return false;
			const name = part.slice(0, colon).trim().toLowerCase();
			const rule = STYLE[name];
			return rule?.test(part.slice(colon + 1).trim()) ?? false;
		});
	if (kept.length === 0) return "";
	return kept.join("; ") + (raw.trim().endsWith(";") ? ";" : "");
}

function cleanAttr(
	tag: string,
	name: string,
	value: string,
	extra: {
		allowed: Record<string, Array<string>>;
		classToken?: RegExp;
		playerSrc: Array<RegExp>;
	},
): string {
	if (!extra.allowed[tag]?.includes(name)) return "";

	if (BOOLEAN.has(name)) return `${name}=""`;

	if (name === "class") {
		const tokens = decodeAttr(value)
			.split(/\s+/)
			.filter(
				(token) =>
					CLASS_TOKEN.test(token) || (extra.classToken?.test(token) ?? false),
			);
		return tokens.length ? attr(name, tokens.join(" ")) : "";
	}
	if (name === "style") {
		const style = cleanStyle(value);
		return style ? attr(name, style) : "";
	}
	if (name === "href") {
		const url = cleanUrl(value, ["https://", "http://", "mailto:", "#"]);
		return url ? attr(name, url) : "";
	}
	if (name === "src") {
		const url = cleanUrl(value, ["https://", "http://"]);
		if (!url) return "";
		if (tag === "iframe" && !extra.playerSrc.some((rule) => rule.test(url)))
			return "";
		return attr(name, url);
	}
	if (name === "rel") {
		const tokens = decodeAttr(value)
			.split(/\s+/)
			.filter((token) => /^(noopener|noreferrer|nofollow|ugc)$/.test(token));
		return tokens.length ? attr(name, tokens.join(" ")) : "";
	}
	if (NUMERIC.has(name)) {
		return /^\d{1,6}$/.test(value) ? attr(name, value) : "";
	}
	const rule = ENUMS[name];
	if (rule) return rule.test(value) ? attr(name, value) : "";

	// 글자로만 쓰이는 것 (alt, title, data-language)
	return attr(name, decodeAttr(value));
}

function iframeSrc(html: string): string | null {
	const match = /\ssrc\s*=\s*"([^"]*)"/i.exec(html);
	return match ? decodeAttr(match[1]).trim() : null;
}

/** 새 창으로 여는 링크가 opener 를 쥐지 못하게 한다. */
function sealBlankTargets(html: string): string {
	return html.replace(/<a\b[^>]*>/g, (tag) => {
		if (!tag.includes('target="_blank"')) return tag;
		if (/\brel="[^"]*noopener[^"]*"/.test(tag)) return tag;
		const withoutRel = tag.replace(/\s+rel="[^"]*"/, "");
		return withoutRel.replace(/>$/, ' rel="noopener noreferrer">');
	});
}

/**
 * 허용 목록을 넓히는 자리.
 *
 * 커스텀 노드를 등록했으면(<Editor nodes={…}>) 그 노드가 내보내는 태그 · 클래스 ·
 * 재생기 주소를 여기로 알려야 독자 화면까지 살아남는다. 기본 목록을 지우지
 * 않고 더하기만 한다 — 좁히는 쪽은 실수해도 조용해서, 넓히는 쪽만 연다.
 */
export type SanitizeOptions = {
	/** 태그 → 허용 속성. 같은 태그를 주면 속성이 합쳐진다. */
	tags?: Record<string, Array<string>>;
	/** class 값으로 통과시킬 이름. 기본 규칙에 or 로 더한다. */
	classes?: RegExp;
	/** iframe src 로 받아 줄 주소. */
	iframeSrc?: Array<RegExp>;
};

export function sanitizeHtml(html: string, options?: SanitizeOptions): string {
	// 막은 iframe 은 닫는 태그까지 같이 뺀다
	let droppingFrame = false;

	const allowed: Record<string, Array<string>> = { ...ALLOWED };
	for (const [tag, attrs] of Object.entries(options?.tags ?? {})) {
		allowed[tag] = [...new Set([...(allowed[tag] ?? []), ...attrs])];
	}
	const playerSrc = [...PLAYER_SRC, ...(options?.iframeSrc ?? [])];
	const classToken = options?.classes;

	const filter = new FilterXSS({
		whiteList: allowed,
		stripIgnoreTag: true,
		stripIgnoreTagBody: ["script", "style", "template", "noscript"],
		allowCommentTag: false,
		onTag: (tag, raw, info) => {
			if (tag !== "iframe") return;
			if (info.isClosing) {
				if (droppingFrame) {
					droppingFrame = false;
					return "";
				}
				return;
			}
			const src = iframeSrc(raw);
			if (!src || !playerSrc.some((rule) => rule.test(src))) {
				droppingFrame = true;
				return "";
			}
		},
		onTagAttr: (tag, name, value) =>
			cleanAttr(tag, name, value, { allowed, classToken, playerSrc }),
		onIgnoreTagAttr: () => "",
	});

	return sealBlankTargets(filter.process(html));
}
