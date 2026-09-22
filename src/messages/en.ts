import type { EditorMessages } from "./types.ts";

export const en: EditorMessages = {
	placeholder: "Start writing. Press `/` to insert a block.",
	crashed: "Something went wrong in the editor. Reload and try again.",

	code: {
		picker: "Code language",
		plain: "Plain text",
	},

	blocks: {
		paragraph: "Text",
		h1: "Heading 1",
		h2: "Heading 2",
		h3: "Heading 3",
		quote: "Quote",
		bulletList: "Bulleted list",
		numberList: "Numbered list",
		checkList: "To-do list",
		code: "Code",
		picker: "Block type",
	},

	insert: {
		image: "Photo",
		imageRow: "Photo row",
		video: "Video",
		embed: "YouTube",
		quote: "Quote",
		divider: "Divider",
		code: "Code",
		table: "Table",
		link: "Link",
		open: "Insert block",
		more: "More",
	},

	hints: {
		paragraph: "Plain paragraph",
		h1: "Largest section heading",
		h2: "Medium section heading",
		h3: "Small section heading",
		quote: "Indent a quotation",
		bulletList: "• Unordered list",
		numberList: "1. Ordered list",
		checkList: "Tick things off",
		code: "Syntax-highlighted code",
		divider: "Separate sections with a line",
		image: "Pick a file",
		imageRow: "Two or three photos, one row",
		video: "MP4 · WebM file",
		embed: "Paste a link to embed a player",
		table: "Start with a 3×3 table",
	},

	format: {
		bold: "Bold",
		italic: "Italic",
		underline: "Underline",
		strikethrough: "Strikethrough",
		inlineCode: "Inline code",
		alignLeft: "Align left",
		alignCenter: "Align center",
		alignRight: "Align right",
		link: "Link",
		unlink: "Remove link",
		panel: "Format",
	},

	divider: {
		line: "Long line",
		short: "Short line",
		bold: "Bold line",
		dots: "Three dots",
		diamond: "Diamond",
	},

	media: {
		captionPlaceholder: "Add a caption (optional)",
		uploading: "Uploading…",
		uploadingPercent: (percent) => `Uploading… ${percent}%`,
		moveLeft: "Move left",
		moveRight: "Move right",
		removeFromRow: "Remove this photo",
		addToRow: "Add photos",
		unpackRow: "Split row",
		watchOn: (provider) => `Watch on ${provider}`,
		uploadFailed: "Couldn't upload the file.",
		missingFile: "Couldn't find the file to upload. Please add it again.",
	},

	url: {
		linkPlaceholder: "Link URL",
		embedPlaceholder: "YouTube · Vimeo URL",
		apply: "Insert",
		cancel: "Cancel",
		embedInvalid: "Only YouTube and Vimeo video links can be embedded.",
	},

	validate: {
		imageType: (formats) => `Only ${formats} images are supported.`,
		imageSize: (megabytes) => `Images can be up to ${megabytes}MB.`,
		videoMov:
			"MOV files don't play in every browser. Please convert to MP4 first.",
		videoType: (formats) => `Only ${formats} videos are supported.`,
		videoSize: (megabytes) => `Videos can be up to ${megabytes}MB.`,
	},

	stats: {
		chars: (count) => `${count.toLocaleString("en-US")} chars`,
		minutes: (count) => `${count} min`,
	},

	mobile: {
		backToKeyboard: "Tap the text to bring the keyboard back",
		close: "Close",
	},
};
