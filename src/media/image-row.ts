/**
 * 사진 여러 장을 한 줄에 놓는 계산.
 *
 * 사진마다 가로세로비만큼 폭을 나눠 가지면 높이가 저절로 같아진다(flex-grow
 * 를 비율로 주고 basis 를 0 으로 둔다). 줄 하나에 세 장까지 — 네 장이면 폰에서
 * 한 장이 80px 남짓이라 무엇을 찍었는지 알아보기 어렵다.
 */
export const MAX_ROW = 3;

/*
 * 한 장이 옆 사진을 짓누르지 않게 양 끝을 자른다. 6:1 파노라마를 그대로 두면
 * 옆에 선 세로 사진이 손톱만 해진다.
 */
const MIN_RATIO = 0.5;
const MAX_RATIO = 2.5;

/** 한 줄 안에서 이 사진이 가져갈 몫. 크기를 모르면 정사각형으로 본다. */
export function flexGrow({
	width,
	height,
}: {
	width: number;
	height: number;
}): number {
	if (!(width > 0) || !(height > 0)) return 1;
	const ratio = width / height;
	return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

/**
 * 한꺼번에 들어온 사진을 줄로 나눈다.
 *
 * 3+1 로 자르면 마지막 한 장이 혼자 넓게 떨어져 앞줄과 크기가 어긋난다. 줄
 * 수를 먼저 정하고 장수를 고르게 나눈다 — 남는 장은 앞줄부터 하나씩 더 받는다.
 */
export function chunkIntoRows<T>(items: Array<T>): Array<Array<T>> {
	if (items.length === 0) return [];
	const rows = Math.ceil(items.length / MAX_ROW);
	const base = Math.floor(items.length / rows);
	const extra = items.length % rows;

	const out: Array<Array<T>> = [];
	let start = 0;
	for (let row = 0; row < rows; row++) {
		const size = base + (row < extra ? 1 : 0);
		out.push(items.slice(start, start + size));
		start += size;
	}
	return out;
}

/** 줄 안에서 한 칸 옮긴다. 끝에서 더 밀면 그대로. */
export function moveItem<T>(
	items: Array<T>,
	index: number,
	delta: -1 | 1,
): Array<T> {
	const target = index + delta;
	if (target < 0 || target >= items.length) return items.slice();
	const next = items.slice();
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

export function removeItem<T>(items: Array<T>, index: number): Array<T> {
	if (index < 0 || index >= items.length) return items.slice();
	return items.filter((_, i) => i !== index);
}
