# 예제

소비 앱의 번들러별로 `@avarlabs/editor`를 띄워 보는 프로젝트입니다.

| 폴더 | 프레임워크 | 번들러 |
| --- | --- | --- |
| `nextjs` | Next.js 16 (App Router) | Turbopack, `--webpack` |
| `react-router-starter` | React Router 8 (SSR) | Vite 8 (Rolldown) |
| `tanstack-router` | TanStack Router (SPA) | Vite 8 (Rolldown) |

각 예제는 이 저장소를 `file:../..`로 설치합니다. pnpm이 `package.json`의 `files`만 복사해 넣고 peer 의존성은 예제 쪽에서 해석하므로, npm에서 받은 것과 같은 조건이 됩니다. 복사본이라 라이브러리를 고친 뒤에는 다시 빌드하고 설치해야 반영됩니다.

```sh
pnpm build                                  # 저장소 루트
cd example/tanstack-router && pnpm install
pnpm build && pnpm preview
```
