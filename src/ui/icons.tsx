import { createElement, type JSX } from "react";

/*
 * 아이콘 모양은 Lucide (https://lucide.dev, ISC) 에서 가져왔다.
 * 아이콘 묶음을 통째로 의존하지 않으려고 쓰는 것만 옮겨 둔다.
 *
 * ISC License — Copyright (c) for portions of Lucide are held by Cole Bemis
 * 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are
 * held by Lucide Contributors 2022. Permission to use, copy, modify, and/or
 * distribute this software for any purpose with or without fee is hereby
 * granted, provided that the above copyright notice and this permission
 * notice appear in all copies.
 */
type Shape = Array<[string, Record<string, string>]>;

const SHAPES = {
	image: [
		["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }],
		["circle", { cx: "9", cy: "9", r: "2" }],
		["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }],
	],
	imageRow: [
		["path", { d: "M2 3v18" }],
		["rect", { width: "12", height: "18", x: "6", y: "3", rx: "2" }],
		["path", { d: "M22 3v18" }],
	],
	video: [
		["path", { d: "m12.296 3.464 3.02 3.956" }],
		[
			"path",
			{
				d: "M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z",
			},
		],
		["path", { d: "M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }],
		["path", { d: "m6.18 5.276 3.1 3.899" }],
	],
	youtube: [
		[
			"path",
			{
				d: "M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17",
			},
		],
		["path", { d: "m10 15 5-3-5-3z" }],
	],
	quote: [
		[
			"path",
			{
				d: "M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
			},
		],
		[
			"path",
			{
				d: "M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
			},
		],
	],
	minus: [["path", { d: "M5 12h14" }]],
	code: [
		["path", { d: "m18 16 4-4-4-4" }],
		["path", { d: "m6 8-4 4 4 4" }],
		["path", { d: "m14.5 4-5 16" }],
	],
	table: [
		["path", { d: "M12 3v18" }],
		["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
		["path", { d: "M3 9h18" }],
		["path", { d: "M3 15h18" }],
	],
	link: [
		[
			"path",
			{ d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" },
		],
		[
			"path",
			{ d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" },
		],
	],
	unlink: [
		[
			"path",
			{
				d: "m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71",
			},
		],
		[
			"path",
			{
				d: "m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71",
			},
		],
		["line", { x1: "8", x2: "8", y1: "2", y2: "5" }],
		["line", { x1: "2", x2: "5", y1: "8", y2: "8" }],
		["line", { x1: "16", x2: "16", y1: "19", y2: "22" }],
		["line", { x1: "19", x2: "22", y1: "16", y2: "16" }],
	],
	bold: [
		[
			"path",
			{
				d: "M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8",
			},
		],
	],
	italic: [
		["line", { x1: "19", x2: "10", y1: "4", y2: "4" }],
		["line", { x1: "14", x2: "5", y1: "20", y2: "20" }],
		["line", { x1: "15", x2: "9", y1: "4", y2: "20" }],
	],
	underline: [
		["path", { d: "M6 4v6a6 6 0 0 0 12 0V4" }],
		["line", { x1: "4", x2: "20", y1: "20", y2: "20" }],
	],
	strikethrough: [
		["path", { d: "M16 4H9a3 3 0 0 0-2.83 4" }],
		["path", { d: "M14 12a4 4 0 0 1 0 8H6" }],
		["line", { x1: "4", x2: "20", y1: "12", y2: "12" }],
	],
	inlineCode: [
		["path", { d: "m16 18 6-6-6-6" }],
		["path", { d: "m8 6-6 6 6 6" }],
	],
	list: [
		["path", { d: "M3 5h.01" }],
		["path", { d: "M3 12h.01" }],
		["path", { d: "M3 19h.01" }],
		["path", { d: "M8 5h13" }],
		["path", { d: "M8 12h13" }],
		["path", { d: "M8 19h13" }],
	],
	listOrdered: [
		["path", { d: "M11 5h10" }],
		["path", { d: "M11 12h10" }],
		["path", { d: "M11 19h10" }],
		["path", { d: "M4 4h1v5" }],
		["path", { d: "M4 9h2" }],
		["path", { d: "M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" }],
	],
	listChecks: [
		["path", { d: "M13 5h8" }],
		["path", { d: "M13 12h8" }],
		["path", { d: "M13 19h8" }],
		["path", { d: "m3 17 2 2 4-4" }],
		["path", { d: "m3 7 2 2 4-4" }],
	],
	alignLeft: [
		["path", { d: "M21 5H3" }],
		["path", { d: "M15 12H3" }],
		["path", { d: "M17 19H3" }],
	],
	alignCenter: [
		["path", { d: "M21 5H3" }],
		["path", { d: "M17 12H7" }],
		["path", { d: "M19 19H5" }],
	],
	alignRight: [
		["path", { d: "M21 5H3" }],
		["path", { d: "M21 12H9" }],
		["path", { d: "M21 19H7" }],
	],
	plus: [
		["path", { d: "M5 12h14" }],
		["path", { d: "M12 5v14" }],
	],
	x: [
		["path", { d: "M18 6 6 18" }],
		["path", { d: "m6 6 12 12" }],
	],
	chevronDown: [["path", { d: "m6 9 6 6 6-6" }]],
	chevronLeft: [["path", { d: "m15 18-6-6 6-6" }]],
	chevronRight: [["path", { d: "m9 18 6-6-6-6" }]],
	type: [
		["path", { d: "M12 4v16" }],
		["path", { d: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" }],
		["path", { d: "M9 20h6" }],
	],
	more: [
		["circle", { cx: "12", cy: "12", r: "1" }],
		["circle", { cx: "19", cy: "12", r: "1" }],
		["circle", { cx: "5", cy: "12", r: "1" }],
	],
	imagePlus: [
		["path", { d: "M16 5h6" }],
		["path", { d: "M19 2v6" }],
		[
			"path",
			{ d: "M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5" },
		],
		["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }],
		["circle", { cx: "9", cy: "9", r: "2" }],
	],
	rows: [
		["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
		["path", { d: "M21 9H3" }],
		["path", { d: "M21 15H3" }],
	],
	play: [
		[
			"path",
			{
				d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
			},
		],
	],
	heading1: [
		["path", { d: "M4 12h8" }],
		["path", { d: "M4 18V6" }],
		["path", { d: "M12 18V6" }],
		["path", { d: "m17 12 3-2v8" }],
	],
	heading2: [
		["path", { d: "M4 12h8" }],
		["path", { d: "M4 18V6" }],
		["path", { d: "M12 18V6" }],
		["path", { d: "M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" }],
	],
	heading3: [
		["path", { d: "M4 12h8" }],
		["path", { d: "M4 18V6" }],
		["path", { d: "M12 18V6" }],
		["path", { d: "M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" }],
		["path", { d: "M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" }],
	],
	check: [["path", { d: "M20 6 9 17l-5-5" }]],
} satisfies Record<string, Shape>;

export type IconName = keyof typeof SHAPES;

export function Icon({
	name,
	size = 18,
	strokeWidth = 1.8,
	className,
}: {
	name: IconName;
	size?: number;
	strokeWidth?: number;
	className?: string;
}): JSX.Element {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={className}
		>
			{(SHAPES[name] as Shape).map(([tag, attrs], index) =>
				// 모양은 고정된 목록이라 순서가 곧 정체다
				createElement(tag, { ...attrs, key: `${name}-${index}` }),
			)}
		</svg>
	);
}
