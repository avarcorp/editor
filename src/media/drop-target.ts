/**
 * 끌어다 놓을 자리 계산. DOM 도 Lexical 도 모른다 — 블록의 위아래 좌표만 받는다.
 *
 * 차례(index)는 "몇 번째 블록 앞에 넣나"다. 블록이 n 개면 0~n.
 */

export type BlockBox = { top: number; bottom: number };

/**
 * 끌고 있는 높이(y)에서 넣을 차례.
 *
 * 블록의 위쪽 절반이면 그 앞, 아래쪽 절반이면 그 뒤. 블록 사이 틈은 어디를
 * 짚어도 같은 경계로 모인다 — 틈에서 선이 깜빡이며 오가지 않게.
 */
export function dropIndex(blocks: Array<BlockBox>, y: number): number {
	for (let index = 0; index < blocks.length; index++) {
		const { top, bottom } = blocks[index];
		if (y < (top + bottom) / 2) return index;
	}
	return blocks.length;
}

/** 맨 앞 · 맨 끝에서 블록과 선 사이에 둘 틈 */
const EDGE_GAP = 6;

/** 그 차례에 선을 그을 높이. 두 블록 사이면 틈의 한가운데. */
export function dropLineY(blocks: Array<BlockBox>, index: number): number {
	if (blocks.length === 0) return 0;
	if (index <= 0) return blocks[0].top - EDGE_GAP;
	if (index >= blocks.length)
		return blocks[blocks.length - 1].bottom + EDGE_GAP;
	return (blocks[index - 1].bottom + blocks[index].top) / 2;
}
