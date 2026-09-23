import { expect, test } from "@playwright/test";

/**
 * 프로덕션 빌드한 예제 앱에서 에디터가 뜨고 코드블록에 색이 입혀지는지 본다.
 *
 * Prism 문법 파일은 평가 순서가 어긋나면 모듈을 여는 순간 `Prism is not defined`
 * 로 죽는다 (#5). SSR 앱은 서버가 아예 뜨지 않으므로 webServer 단계에서 걸린다.
 */
test("에디터가 오류 없이 뜨고 코드블록을 하이라이트한다", async ({ page }) => {
	// 라우터가 라우트 모듈 오류를 잡아 console.error 로만 남기기도 해서 둘 다 모은다
	const errors: Array<string> = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		// 예제에 없는 favicon 같은 리소스 404 는 에디터와 무관하다
		if (message.type() !== "error") return;
		if (message.text().startsWith("Failed to load resource")) return;
		errors.push(message.text());
	});

	await page.goto("/");

	// 라우트 청크는 load 뒤에 올 수 있다. 에디터가 뜨거나 오류가 날 때까지 본다
	const content = page.locator(".editor-input[contenteditable=true]");
	await expect
		.poll(async () => errors.length > 0 || (await content.isVisible()))
		.toBe(true);
	// 모듈 평가 중에 죽었다면 에디터가 없다는 것보다 이 오류가 원인이다
	expect(errors).toEqual([]);
	await expect(content).toBeVisible();

	// CodeHighlightPlugin 이 따로 싣는 문법(bash)으로 확인한다
	await content.click();
	await page.getByRole("button", { name: "코드", exact: true }).click();
	await page.getByRole("button", { name: "코드 언어" }).click();
	await page.getByRole("menuitemradio", { name: "Bash" }).click();
	await page.locator("code.editor-code").click();
	await page.keyboard.type('echo "hi" # note');

	const code = page.locator("code.editor-code");
	await expect(code.locator(".editor-token-comment")).toHaveText("# note");
	// theme.ts 는 builtin(echo) 과 string 을 같은 색으로 묶는다. echo 는 bash 문법에만 있다
	await expect(code.locator(".editor-token-selector")).toHaveText([
		"echo",
		'"hi"',
	]);
	expect(errors).toEqual([]);
});
