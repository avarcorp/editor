# 기여 가이드

`@avarlabs/editor`의 내부 구조와 개발 규칙을 설명합니다. 사용법은 [README.md](./README.md)를 참고하세요.

패키지는 현재 loggy 저장소(모노레포)의 `packages/editor`에 있습니다. 아래 명령과 경로는 저장소 루트 기준입니다.

## 디렉터리 구조

```
src/
├─ index.ts      공개 API(export 목록)
├─ Editor.tsx    <Editor>, <Content>, EditorHandle, 자동 저장·통계 플러그인
├─ actions.ts    insert(), setBlock(), editLink(), normalizeUrl()
├─ context.tsx   EditorEnv 컨텍스트(messages, limits, media, notify, askUrl)
├─ theme.ts      Lexical 테마 클래스(editor-*)
├─ cx.ts         클래스 이름 결합
├─ nodes/        커스텀 노드, 등록 목록(editorNodes), 블록 삽입 위치(insert-block.ts)
├─ plugins/      슬래시 메뉴, 미디어, 블록 삽입 버튼, 구분선, 자동 저장, 툴바 상태
├─ ui/           툴바, 모바일 툴바, 팝오버, URL 입력, 구분선 선택, 메뉴 항목, 아이콘
├─ media/        업로드 파이프라인, pending media 스토어, 파일 검증, 이미지 행 계산, 임베드 URL 파서
├─ format/       직렬화, 새니타이저, 마크다운 트랜스포머, 글자 수 통계
├─ messages/     메시지 타입, ko, en, 에디터별 메시지 레지스트리
└─ styles/       editor.css, reader.css
```

## 명령

```sh
pnpm test            # vitest. packages/*/src/**/*.test.ts(x) 포함
pnpm check:editor    # 노드 등록, 마크다운 변환, JSON 복원 스모크 테스트
npx tsc --noEmit     # 타입 검사
npx biome ci .       # 린트·포맷 검사
```

커밋하면 husky pre-commit 훅이 변경 파일에 biome을 실행합니다.

## 패키지 경계

패키지 안에서 import할 수 있는 모듈은 `react`, `react-dom`, `lexical`, `@lexical/*`, `xss`와 패키지 내부 파일뿐입니다. `boundary.test.ts`가 모든 소스 파일의 import를 검사하며, 허용 목록 밖의 모듈을 가져오면 실패합니다. 앱 코드, 라우터, 데이터 페칭 라이브러리, 아이콘 패키지, CSS 유틸리티 도우미가 여기에 해당합니다.

아이콘이 필요하면 `ui/icons.tsx`에 도형을 추가합니다. Lucide 아이콘은 `lucide-react/dist/esm/icons/{이름}.js`의 `__iconNode` 배열을 옮기고, 파일 상단의 ISC 고지를 유지합니다.

## 저장소 안의 import 경로

모노레포에서는 별칭으로 패키지 소스에 연결합니다.

| 설정 | 규칙 |
| --- | --- |
| `tsconfig.json` paths | `@avarlabs/editor` → `packages/editor/src/index.ts`, `@avarlabs/editor/*` → `packages/editor/src/*` |
| `vitest.config.ts` alias | tsconfig paths와 같은 규칙 |
| Vite | `resolve.tsconfigPaths`로 tsconfig paths를 따름 |

따라서 저장소 안에서는 `sanitizeHtml`을 `@avarlabs/editor/format/sanitize.ts`로 가져옵니다. `@avarlabs/editor/sanitize`는 `package.json`의 `exports`가 정의하는 배포용 경로입니다.

## 테스트

새 동작은 테스트를 먼저 작성합니다.

**헤드리스 Lexical.** `createEditor({ nodes: editorNodes, theme: editorTheme })`로 브라우저 없이 인스턴스를 만들고, 편집은 `editor.update(fn, { discrete: true })`로 동기 커밋합니다. 리치 텍스트·목록 커맨드가 필요하면 `registerRichText`, `registerList`를 등록합니다. 예시는 `actions.test.ts`, `nodes/ImageRowNode.test.ts`에 있습니다.

**`exportDOM` 테스트.** `$generateHtmlFromNodes`는 DOM이 필요하므로 파일 첫 줄에 `// @vitest-environment happy-dom`을 지정합니다. happy-dom에서는 Lexical `TableNode.exportDOM`이 빈 결과를 반환합니다(`isHTMLTableElement` 판정 차이, Lexical 0.50 기준). 표의 HTML 출력은 브라우저에서 확인합니다.

**노드 트랜스폼 테스트.** `registerNodeTransform`은 등록 시점에 기존 노드를 dirty로 표시하는 업데이트를 예약합니다. 문서를 먼저 불러온 뒤 트랜스폼을 등록하고, `discrete` 업데이트로 반영 결과를 확인합니다. 예시는 `nodes/DividerNode.test.ts`에 있습니다.

## 새 노드 추가

1. `nodes/`에 노드를 작성합니다. 업로드 상태처럼 저장하지 않을 필드는 `exportJSON`에서 빼고 `updateFromJSON`에서 초기화합니다.
2. `nodes/index.ts`의 `editorNodes`에 등록합니다.
3. `format/sanitize.test.ts`의 전체 노드 문서(`editorHtml()`)에 새 노드를 추가합니다. 허용 목록을 갱신하기 전에는 이 테스트가 실패해야 합니다.
4. `format/sanitize.ts`의 허용 목록(태그, 속성, 클래스 토큰, 스타일 속성)을 갱신합니다.
5. 읽기 화면 스타일은 `styles/reader.css`, 편집 화면 스타일은 `styles/editor.css`에 둡니다. 색은 `--editor-*`만 참조합니다.
6. UI 문구가 필요하면 `messages/types.ts`에 키를 추가하고 `ko.ts`, `en.ts`를 채웁니다.
7. 삽입 UI에 노출하려면 `actions.ts`의 `InsertId`와 `insert()`, `ui/menu-items.ts`, `ui/Toolbar.tsx`, `ui/MobileBar.tsx`를 갱신합니다.
8. 기존 노드 타입을 바꾸거나 없애면 README의 [마이그레이션](./README.md#마이그레이션) 절차를 따릅니다.

## 코드 규칙

- 사용자에게 보이는 문자열을 컴포넌트에 직접 쓰지 않습니다. React 안에서는 `useMessages()`로, React 밖(`exportDOM`)에서는 `messagesOf(editor)`로 가져옵니다.
- 클래스 접두사는 두 가지입니다. `editor-*`는 노드 테마 클래스로 저장되는 HTML에 포함되므로 이름을 바꾸지 않습니다. `le-*`는 편집 화면 UI에만 씁니다.
- CSS 커스텀 속성의 기본값은 `:where(:root)`에 둡니다. 명시도를 0으로 유지해야 앱의 재정의가 항상 적용됩니다.
- 삽입은 모두 `insert()`를 거칩니다. 툴바, 블록 삽입 버튼, 슬래시 메뉴, 모바일 패널이 같은 경로를 쓰도록 새 UI에서 삽입 커맨드를 직접 dispatch하지 않습니다.
- 블록 노드는 `nodes/insert-block.ts`의 `$insertBlock()`으로 넣습니다. 빈 문단에서 삽입하면 그 문단 자리에 들어갑니다.
- 자동 저장을 트리거하면 안 되는 내부 편집에는 `SKIP_AUTOSAVE_TAG`와 `history-merge` 태그를 붙입니다(`media/media-upload.ts`).
- `xss`는 CommonJS 패키지라 Node ESM에서 `FilterXSS` 외의 named export를 찾지 못합니다. `xss`에서는 `FilterXSS`만 import합니다.

## 커밋

커밋 메시지는 Conventional Commits 형식을 따르며 commitlint가 검사합니다. 에디터 변경은 `feat(editor): …`, `fix(editor): …`처럼 `editor` 스코프를 씁니다.
