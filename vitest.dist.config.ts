import { defineConfig } from "vitest/config";

/** 빌드한 dist 를 소비자처럼 불러 보는 테스트. `pnpm test:dist` 가 빌드부터 한다. */
export default defineConfig({
	test: {
		environment: "node",
		include: ["test/consumer/**/*.test.ts"],
	},
});
