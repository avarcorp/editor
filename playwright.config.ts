import { defineConfig, devices } from "@playwright/test";

/**
 * 예제 앱의 프로덕션 빌드를 브라우저로 열어 본다. `pnpm test:e2e` 가 라이브러리를
 * 먼저 빌드하고, 각 예제는 그 dist 를 다시 설치(file:../..)해 빌드한 뒤 띄운다.
 * 포트는 예제 README 의 수동 확인용 포트와 겹치지 않게 43xx 를 쓴다.
 *
 * webServer 는 프로젝트를 골라도 전부 뜬다. 하나만 볼 때는 EXAMPLE=tanstack-router 처럼 준다.
 */
const ALL_EXAMPLES = [
	{
		name: "nextjs",
		port: 4301,
		start: "pnpm exec next start -p 4301",
	},
	{
		name: "react-router-starter",
		port: 4302,
		start: "PORT=4302 pnpm start",
	},
	{
		name: "tanstack-router",
		port: 4303,
		start: "pnpm exec vite preview --port 4303 --strictPort",
	},
];

const EXAMPLES = process.env.EXAMPLE
	? ALL_EXAMPLES.filter(({ name }) => name === process.env.EXAMPLE)
	: ALL_EXAMPLES;

export default defineConfig({
	testDir: "e2e",
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? "github" : "list",
	use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
	projects: EXAMPLES.map(({ name, port }) => ({
		name,
		use: { baseURL: `http://localhost:${port}` },
	})),
	webServer: EXAMPLES.map(({ name, port, start }) => ({
		command: `cd example/${name} && pnpm install && pnpm build && ${start}`,
		port,
		// 예전 빌드를 띄운 채로 두면 고친 dist 를 보지 못한다
		reuseExistingServer: false,
		timeout: 180_000,
		stdout: "ignore",
		stderr: "pipe",
	})),
});
