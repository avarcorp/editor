import type { EditorMessages } from "./types.ts";

/** 한국어 — 기본값. 이름은 명사로, 문장은 합니다체로 짧게. */
export const ko: EditorMessages = {
	placeholder: "이야기를 작성해보세요. `/` 를 누르면 블록을 넣을 수 있습니다.",
	crashed: "에디터에서 문제가 생겼습니다. 새로고침한 뒤 다시 시도해 주십시오.",

	code: {
		picker: "코드 언어",
		plain: "일반 텍스트",
	},

	blocks: {
		paragraph: "본문",
		h1: "제목 1",
		h2: "제목 2",
		h3: "제목 3",
		quote: "인용구",
		bulletList: "글머리 목록",
		numberList: "번호 목록",
		checkList: "할 일 목록",
		code: "코드",
		picker: "문단 모양",
	},

	insert: {
		image: "사진",
		imageRow: "사진 나란히",
		video: "영상",
		embed: "유튜브",
		quote: "인용구",
		divider: "구분선",
		code: "코드",
		table: "표",
		link: "링크",
		open: "블록 넣기",
		more: "더 넣기",
	},

	hints: {
		paragraph: "일반 문단으로 되돌립니다",
		h1: "가장 큰 소제목",
		h2: "중간 소제목",
		h3: "작은 소제목",
		quote: "옮겨 온 말을 들여 씁니다",
		bulletList: "• 순서 없는 목록",
		numberList: "1. 순서 있는 목록",
		checkList: "할 일을 하나씩 지웁니다",
		code: "문법 강조가 되는 코드",
		divider: "가로선으로 문단을 나눕니다",
		image: "파일을 골라 넣습니다",
		imageRow: "두세 장을 높이 맞춰 한 줄에",
		video: "MP4 · WebM 파일",
		embed: "주소를 붙이면 재생기가 들어갑니다",
		table: "3×3 표로 시작합니다",
	},

	format: {
		bold: "굵게",
		italic: "기울임",
		underline: "밑줄",
		strikethrough: "취소선",
		inlineCode: "인라인 코드",
		alignLeft: "왼쪽 정렬",
		alignCenter: "가운데 정렬",
		alignRight: "오른쪽 정렬",
		link: "링크",
		unlink: "링크 풀기",
		panel: "서식",
	},

	divider: {
		line: "긴 선",
		short: "짧은 선",
		bold: "굵은 선",
		dots: "점 세 개",
		diamond: "마름모",
	},

	media: {
		captionPlaceholder: "설명 추가 (선택)",
		uploading: "올리는 중…",
		uploadingPercent: (percent) => `올리는 중… ${percent}%`,
		moveLeft: "왼쪽으로",
		moveRight: "오른쪽으로",
		removeFromRow: "이 사진 빼기",
		addToRow: "사진 추가",
		unpackRow: "따로 놓기",
		watchOn: (provider) => `${provider}에서 보기`,
		uploadFailed: "파일을 올리지 못했습니다.",
		missingFile: "올릴 파일을 찾지 못했습니다. 다시 붙여 주십시오.",
	},

	url: {
		linkPlaceholder: "링크 주소",
		embedPlaceholder: "유튜브 · 비메오 주소",
		apply: "넣기",
		cancel: "취소",
		embedInvalid: "유튜브 · 비메오 영상 주소만 넣을 수 있습니다.",
	},

	validate: {
		imageType: (formats) => `${formats} 이미지만 올릴 수 있습니다.`,
		imageSize: (megabytes) => `이미지는 ${megabytes}MB까지 올릴 수 있습니다.`,
		videoMov: "MOV는 브라우저마다 재생이 갈립니다. MP4로 바꿔서 올려 주십시오.",
		videoType: (formats) => `${formats} 영상만 올릴 수 있습니다.`,
		videoSize: (megabytes) => `영상은 ${megabytes}MB까지 올릴 수 있습니다.`,
	},

	stats: {
		chars: (count) => `${count.toLocaleString("ko-KR")}자`,
		minutes: (count) => `약 ${count}분`,
	},

	mobile: {
		backToKeyboard: "글을 누르면 키보드로 돌아갑니다",
		close: "닫기",
	},
};
