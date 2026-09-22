/**
 * 에디터가 화면에 내는 문구 전부.
 *
 * 패키지 안 어디에도 문장을 직접 적지 않는다. 앱은 한국어(기본)나 영어를 고르고,
 * 일부만 바꾸고 싶으면 덮어쓴다 — `{ ...ko, placeholder: "…" }`.
 */
export type EditorMessages = {
	/** 빈 문서 안내. 백틱으로 감싼 부분(`/`)은 키 모양으로 그린다. */
	placeholder: string;
	/** 에디터 자체가 망가졌을 때 */
	crashed: string;

	/** 코드블록 언어 고르기 */
	code: {
		picker: string;
		plain: string;
	};

	blocks: {
		paragraph: string;
		h1: string;
		h2: string;
		h3: string;
		quote: string;
		bulletList: string;
		numberList: string;
		checkList: string;
		code: string;
		/** 본문▾ 고르개의 이름 */
		picker: string;
	};

	insert: {
		image: string;
		imageRow: string;
		video: string;
		embed: string;
		quote: string;
		divider: string;
		code: string;
		table: string;
		link: string;
		/** [+] 단추 */
		open: string;
		/** 모바일 ⋯ */
		more: string;
	};

	/** / 메뉴의 한 줄 설명 */
	hints: {
		paragraph: string;
		h1: string;
		h2: string;
		h3: string;
		quote: string;
		bulletList: string;
		numberList: string;
		checkList: string;
		code: string;
		divider: string;
		image: string;
		imageRow: string;
		video: string;
		embed: string;
		table: string;
	};

	format: {
		bold: string;
		italic: string;
		underline: string;
		strikethrough: string;
		inlineCode: string;
		alignLeft: string;
		alignCenter: string;
		alignRight: string;
		link: string;
		unlink: string;
		/** 모바일 서식 판을 여는 단추 */
		panel: string;
	};

	divider: {
		line: string;
		short: string;
		bold: string;
		dots: string;
		diamond: string;
	};

	media: {
		captionPlaceholder: string;
		uploading: string;
		uploadingPercent: (percent: number) => string;
		moveLeft: string;
		moveRight: string;
		removeFromRow: string;
		addToRow: string;
		unpackRow: string;
		watchOn: (provider: string) => string;
		uploadFailed: string;
		missingFile: string;
	};

	url: {
		linkPlaceholder: string;
		embedPlaceholder: string;
		apply: string;
		cancel: string;
		embedInvalid: string;
	};

	validate: {
		imageType: (formats: string) => string;
		imageSize: (megabytes: number) => string;
		videoMov: string;
		videoType: (formats: string) => string;
		videoSize: (megabytes: number) => string;
	};

	stats: {
		chars: (count: number) => string;
		minutes: (count: number) => string;
	};

	mobile: {
		/** 서식 판 아래 한 줄 */
		backToKeyboard: string;
		close: string;
	};
};
