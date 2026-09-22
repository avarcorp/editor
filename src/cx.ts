/** 클래스 이름을 잇는다. 거짓 값은 뺀다. */
export function cx(...names: Array<string | false | null | undefined>): string {
	return names.filter(Boolean).join(" ");
}
