# @avarlabs/editor

[Lexical](https://lexical.dev) 기반의 블로그용 리치 텍스트 에디터입니다. 한국어 IME 조합을 우선으로 설계했고, 업로드·저장·문구·색을 모두 외부에서 주입받습니다.

- **혼자 서거나, 조립하거나** — `<Editor toolbar={EditorToolbar} />` 한 줄이면 도구 줄과 본문이 함께 섭니다. `children`을 주면 그 배치를 그대로 씁니다.
- **업로드는 어댑터로** — 파일을 어디에 올릴지는 패키지가 모릅니다. `media.upload`가 공개 주소를 돌려주면 됩니다.
- **지연 업로드** — 이미지·동영상은 삽입 시 blob URL 미리보기로만 표시하고, `save()`에서 업로드한 뒤 URL을 교체합니다. 삽입했다가 삭제한 파일은 업로드되지 않습니다.
- **화면 폭별 툴바** — 넓은 화면(> 640px)은 삽입 툴바와 서식 툴바, 좁은 화면(≤ 640px)은 가상 키보드 위에 붙는 툴바를 사용합니다.
- **이미지 행** — 이미지 2–3장을 높이를 맞춰 한 줄에 배치합니다.
- **HTML 새니타이저** — 에디터가 출력하는 마크업만 허용합니다. DOM 없이 동작하므로 Cloudflare Workers와 Node에서 사용할 수 있습니다.
- **i18n·테마** — 모든 UI 문구는 메시지 객체(`ko`, `en` 내장)로, 모든 색은 CSS 커스텀 속성(`--editor-*`)으로 바꿉니다.

## 목차

- [설치](#설치)
- [빠른 시작](#빠른-시작)
- [구성](#구성)
- [앱이 처리할 것](#앱이-처리할-것)
- [API](#api)
- [미디어 라이브러리 연동](#미디어-라이브러리-연동)
- [저장 파이프라인](#저장-파이프라인)
- [자동 저장](#자동-저장)
- [입력](#입력)
- [i18n](#i18n)
- [테마](#테마)
- [직렬화 형식](#직렬화-형식)
- [알려진 제약](#알려진-제약)
- [라이선스](#라이선스)

## 설치

```sh
pnpm add @avarlabs/editor \
  lexical @lexical/code @lexical/code-prism @lexical/html @lexical/link \
  @lexical/list @lexical/markdown @lexical/react @lexical/rich-text \
  @lexical/selection @lexical/table @lexical/utils \
  react react-dom
```

| peer dependency | 버전 |
| --- | --- |
| `react`, `react-dom` | ^19.0.0 |
| `lexical`, `@lexical/*` | ^0.50.0 |
| `prismjs` | ^1.30.0 |

Lexical 은 0.x 마이너에서 파괴적 변경을 내므로 범위를 좁게 잡았습니다. 같은 `lexical` 인스턴스를 공유해야 하니 버전을 섞지 마세요.

런타임 의존성은 `xss` 하나입니다. ESM 과 타입 선언을 빌드해 배포합니다(`dist`).

## 빠른 시작

### 혼자 세우기

에디터만 띄우는 화면(새 창)이라면 이것으로 끝납니다.

```tsx
import { Editor, EditorToolbar, type MediaAdapter } from "@avarlabs/editor";
import "@avarlabs/editor/styles/editor.css";

const media: MediaAdapter = {
  upload: async (file, kind, onProgress) => {
    const { url } = await uploadToStorage(file, onProgress);
    return url; // 공개 주소
  },
};

export function WritePage() {
  return <Editor toolbar={EditorToolbar} media={media} />;
}
```

제목 칸·발행 단추처럼 글을 둘러싼 것은 이 패키지의 몫이 아닙니다. 그런 화면은 `children`으로 직접 짭니다.


### 최소 예제

```tsx
import "@avarlabs/editor/styles/editor.css";
import {
  Content,
  Editor,
  type EditorHandle,
  type MediaAdapter,
  Toolbar,
} from "@avarlabs/editor";
import { useRef } from "react";

// 파일을 받아 공개 URL을 돌려주는 엔드포인트가 있다고 가정합니다
const media: MediaAdapter = {
  async upload(file) {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    const { url } = (await res.json()) as { url: string };
    return url;
  },
};

export function SimpleEditor({ initial }: { initial?: string }) {
  const handleRef = useRef<EditorHandle>(null);

  async function save() {
    const content = await handleRef.current?.save();
    if (!content) return;
    await fetch("/api/posts", {
      method: "POST",
      body: JSON.stringify({ json: content.json, html: content.html }),
    });
  }

  return (
    <Editor initial={initial} media={media} handleRef={handleRef}>
      <Toolbar />
      <Content />
      <button type="button" onClick={save}>
        저장
      </button>
    </Editor>
  );
}
```

`save()`는 삽입한 이미지를 업로드한 뒤 문서를 직렬화합니다. 저장한 `json`을 `initial`로 넘기면 같은 문서를 다시 엽니다. 이미지를 쓰지 않으면 `media`를 빼도 되지만, 이 경우 툴바의 이미지·동영상 버튼은 동작하지 않습니다.

아래는 자동 저장, 오류 처리, 모바일 툴바, 서버 새니타이즈까지 포함한 구성입니다.

### 1. 스타일시트

```css
/* 편집 화면. reader.css를 포함합니다 */
@import "@avarlabs/editor/styles/editor.css";
```

읽기 전용 페이지에는 `@avarlabs/editor/styles/reader.css`만 불러오세요.

### 2. 에디터

```tsx
import {
  Content,
  Editor,
  type EditorHandle,
  type MediaAdapter,
  MobileBar,
  Toolbar,
  UploadError,
} from "@avarlabs/editor";
import { useRef, useState } from "react";

const media: MediaAdapter = {
  async upload(file, kind, onProgress) {
    try {
      return await uploadToStorage(file, kind, onProgress);
    } catch {
      // UploadError의 message는 save()의 오류로 그대로 전달됩니다
      throw new UploadError("파일을 업로드하지 못했습니다.");
    }
  },
};

export function PostEditor({ post }: { post: Post }) {
  const handleRef = useRef<EditorHandle>(null);
  const saving = useRef<Promise<void> | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 저장 호출을 순차로 묶습니다
  function save() {
    const handle = handleRef.current;
    if (!handle) return;
    saving.current = (saving.current ?? Promise.resolve()).then(async () => {
      try {
        const { json, html, plainText, dropped } = await handle.save();
        await api.savePost(post.id, { json, html, plainText });
        if (dropped > 0) setToast(`${dropped}개의 파일을 다시 넣어 주세요.`);
      } catch (error) {
        setToast(error instanceof UploadError ? error.message : "저장하지 못했습니다.");
      }
    });
  }

  return (
    <>
      <Editor
        key={post.id}
        initial={post.contentJson}
        media={media}
        handleRef={handleRef}
        onAutoSave={save}
        onNotify={setToast}
      >
        <Toolbar className="sticky top-0 z-40" />
        <input placeholder="제목" /> {/* 앱의 필드는 자유롭게 끼워 넣습니다 */}
        <Content className="prose" />
        <MobileBar end={<button type="button" onClick={save}>저장</button>} />
      </Editor>
      {toast ? <p role="status">{toast}</p> : null}
    </>
  );
}
```

### 3. 서버에서 새니타이즈

```ts
import { sanitizeHtml } from "@avarlabs/editor/sanitize";

await db.posts.insert({
  contentJson: body.json,
  contentHtml: sanitizeHtml(body.html),
});

const html = sanitizeHtml(post.contentHtml); // 렌더링 시 한 번 더
```

## 구성

```
<Editor>                ← LexicalComposer, 컨텍스트, 공통 플러그인
├─ <Toolbar />          ← 넓은 화면(> 640px)
├─ (앱의 제목 입력 등)
├─ <Content />          ← contentEditable, 블록 삽입 버튼(+)
└─ <MobileBar />        ← 좁은 화면(≤ 640px)
```

`<Editor>`의 children은 모두 같은 Lexical 인스턴스와 컨텍스트를 공유합니다. 툴바와 본문 사이에 앱의 필드를 배치하거나, 필요 없는 컴포넌트를 빼거나, 직접 만든 컴포넌트를 넣으세요.

패키지는 업로드 대상, 저장 방식, 라우팅, 데이터 페칭을 알지 못합니다. 앱은 `MediaAdapter`와 콜백 props로만 이를 전달합니다.

## 앱이 처리할 것

라이브러리가 대신할 수 없어 앱 코드에 영향을 주는 항목입니다.

**문서 전환 시 `key` 교체.** `initial`은 마운트 시 한 번만 읽습니다. 다른 문서를 열 때 `key`를 바꾸지 않으면 이전 문서가 그대로 남습니다.

```tsx
<Editor key={post.id} initial={post.contentJson}>…</Editor>
```

**저장 호출 순차화.** `save()`는 동시 호출을 막지 않습니다. 새 문서가 서버 ID를 받기 전에 저장 요청이 두 번 나가면 문서가 중복 생성됩니다. 자동 저장과 수동 저장 버튼이 겹치는 구간이 특히 위험하므로 앱에서 큐로 묶으세요.

**`dropped` 안내.** 새로고침 등으로 파일이 사라진 미리보기는 `save()`가 문서에서 제거하고 개수를 `dropped`로 돌려줍니다. 앱이 안내하지 않으면 사용자는 이미지가 사라진 사실을 모른 채 저장을 마칩니다.

**업로드 오류 메시지.** 어댑터가 던진 오류가 `UploadError`이면 그 message가 `save()`의 reject 값에 그대로 담기고, 그 외에는 `messages.media.uploadFailed`로 대체됩니다. 라이브러리는 이 메시지를 화면에 표시하지 않으므로 앱이 `save()`의 오류를 받아 표시하세요. 사용자에게 보여 줄 문장은 `UploadError`로 감싸 던지세요.

**`onNotify` 표시.** 파일 검증 실패, 잘못된 임베드 URL, 에디터 오류는 `onNotify`로만 전달됩니다. 표시 UI는 앱이 만듭니다.

**서버 새니타이즈.** `html`은 클라이언트가 보낸 값입니다. 저장할 때와 렌더링할 때 모두 `sanitizeHtml`을 거치세요. 렌더링 시점에도 새니타이즈하면 허용 목록을 좁혔을 때 이미 저장된 HTML에 즉시 적용됩니다.

**테마 클래스 고정.** `editor-*` 클래스는 저장되는 HTML에 포함됩니다. 나중에 바꾸면 기존 문서와 새 문서의 스타일이 갈립니다.

**블록 삽입 버튼 여백.** 버튼은 본문 영역 왼쪽 바깥(`left: -44px`)에 배치됩니다. 감싸는 요소에 여백을 두세요.

**읽기 전용 화면의 툴바.** `editable={false}`여도 children에 있는 `<Toolbar>`와 `<MobileBar>`는 렌더링됩니다. 읽기 전용 화면에서는 두 컴포넌트를 빼세요.

## API

### `<Editor>`

`<Editor>` 는 두 가지로 씁니다. `children` 을 주지 않으면 도구 줄과 본문을 스스로 세우고, 주면 그 배치를 그대로 씁니다. 둘은 타입에서 배타입니다 — `children` 과 `toolbar` 를 같이 주면 컴파일이 막습니다.

**공통**

| prop | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `initial` | `string \| null` | — | 직렬화된 Lexical 에디터 상태. **마운트 시 한 번만 읽습니다.** 다른 글로 바꾸려면 `handle.setContent()` 를 부르거나 `key` 를 바꿔 다시 마운트하세요. |
| `media` | `MediaAdapter` | — | 미디어 업로드 어댑터. 없으면 이미지·동영상을 삽입할 수 없습니다. |
| `handleRef` | `Ref<EditorHandle>` | — | 저장·읽기용 핸들 |
| `onAutoSave` | `(handle: EditorHandle) => void` | — | 편집 중단 콜백. 라이브러리는 저장하지 않으므로 콜백 안에서 `handle.save()`를 호출하세요. |
| `autoSaveDelay` | `number` | `1500` | `onAutoSave` 디바운스 시간(ms) |
| `onStats` | `(stats: EditorStats) => void` | — | 글자 수와 예상 읽기 시간. 마운트 시 한 번, 이후 모든 업데이트마다 호출됩니다. IME 조합 중에는 호출하지 않습니다. 렌더마다 새 함수를 넘겨도 다시 등록하지 않습니다. |
| `onNotify` | `(message: string) => void` | — | 사용자 알림 메시지 |
| `messages` | `EditorMessages` | `ko` | UI 문구 |
| `editable` | `boolean` | `true` | 편집 가능 여부. 마운트 뒤에 바꿔도 따라갑니다. `false`이면 슬래시 메뉴·미디어·자동 저장·통계·블록 삽입 버튼이 등록되지 않습니다. |
| `namespace` | `string` | `"editor"` | Lexical 네임스페이스 |
| `nodes` | `Array<Klass<LexicalNode>>` | — | 기본 노드에 더할 커스텀 노드. 마운트 시 한 번만 읽습니다. 그 노드의 HTML 은 [`sanitizeHtml`](#sanitizehtml) 에도 알려야 독자 화면까지 살아남습니다. |

콜백과 `messages` 는 인라인으로 넘겨도 됩니다. 내부에서 최신 값만 참조하므로, 부모가 다시 그려도 예약해 둔 자동저장이 풀리거나 통계 구독이 다시 걸리지 않습니다.

**혼자 설 때** (`children` 없이)

| prop | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `toolbar` | `ComponentType \| ReactElement \| null` | — | 맨 위 도구 줄. 컴포넌트를 주면 여기서 만들고, 만들어 둔 요소를 주면 그대로 씁니다. 없으면 도구 줄이 없습니다. |
| `mobileBar` | `ComponentType \| ReactElement \| null` | — | 좁은 화면 도구 줄. 규칙은 `toolbar` 와 같습니다. |
| `floatingToolbar` | `boolean` | `true` | 글자를 끌었을 때 뜨는 작은 줄 |
| `className` | `string` | — | 본문 칸에 입힐 활자 클래스 |
| `placeholder` | `string` | `messages.placeholder` | 빈 본문 안내 |

**조립할 때**

| prop | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `children` | `ReactNode` | — | `<Toolbar />` · `<Content />` · `<MobileBar />` 와 앱의 것을 섞어 배치합니다. 이쪽을 고르면 위 다섯 개는 쓸 수 없습니다. |

### `EditorHandle`

| 메서드 | 반환 | 설명 |
| --- | --- | --- |
| `save()` | `Promise<EditorContent & { dropped: number }>` | 남은 미리보기 파일을 업로드하고 공개 URL로 교체한 뒤 직렬화합니다. 업로드에 실패하면 `UploadError`로 reject하고 미리보기는 문서에 남습니다. 다시 호출하면 재시도합니다. |
| `read()` | `EditorContent` | 업로드 없이 현재 문서를 직렬화합니다. |
| `isEmpty()` | `boolean` | 저장할 것이 있는지. 빈 문단 하나뿐일 때만 `true` 입니다 — 사진·임베드·표·구분선만 있는 글은 빈 글이 아닙니다. |
| `setContent(json)` | `void` | 다른 글로 갈아 끼웁니다. 되돌리기 이력과 대기 중인 파일을 함께 비웁니다. |
| `clear()` | `void` | 본문을 비웁니다. 이력과 대기 파일도 같이 비웁니다. |
| `focus()` | `void` | 본문에 포커스를 줍니다. 커서가 있으면 그 자리를 지키고, 없으면 글 끝의 이어 쓸 수 있는 자리에 둡니다 — 마지막 블록이 이미지·구분선·표·코드블록이면 그 아래에 빈 문단을 만듭니다. |
| `insertMedia(items, layout?)` | `void` | 이미 호스팅된 이미지·동영상(`MediaRef[]`)을 커서 위치에 삽입합니다. 커서가 없으면 문서 끝에 추가합니다. [미디어 라이브러리 연동](#미디어-라이브러리-연동) 참고 |
| `lexical()` | `LexicalEditor \| null` | 내부 Lexical 인스턴스 |

```ts
type EditorContent = {
  json: string;      // 직렬화된 에디터 상태. `initial`에 그대로 넘깁니다
  html: string;      // 읽기 화면용 HTML. 서버에서 새니타이즈한 뒤 저장합니다
  plainText: string; // 검색·요약·읽기 시간 계산용 텍스트
};
```

### `<Content>`

본문 영역(contentEditable)입니다. `editable`이면 커서가 있는 빈 문단 왼쪽에 블록 삽입 버튼을 표시합니다. 버튼은 루트 바로 아래의 빈 문단에서만 나타나며, 헤딩·목록·표 셀 안에서는 나타나지 않습니다.

`editable`이면 contentEditable 요소는 내용 높이만 차지하고, 그 아래 빈 영역(최소 40vh)이 붙습니다. 빈 영역을 누르면 글 끝에 커서를 둡니다. 마지막 블록이 이미지·구분선·표·코드블록처럼 본문을 이어 쓸 수 없는 블록이면 그 아래에 새 문단을 만듭니다. contentEditable 요소를 크게 잡으면 태블릿 브라우저가 가상 키보드를 띄울 때 요소 전체를 보이게 하려고 페이지를 스크롤하기 때문입니다.

입력 중에는 커서 아래로 32px 여유가 남도록 페이지를 내립니다. 보이는 영역은 `visualViewport`와 `<MobileBar>` 기준으로 계산하므로 가상 키보드나 모바일 툴바에 커서가 가려지지 않습니다. 포커스나 커서 이동만 있을 때는 스크롤하지 않습니다.

| prop | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `className` | `string` | — | contentEditable 요소의 클래스. 읽기 화면과 같은 타이포그래피 클래스를 지정하면 편집 결과와 렌더링 결과가 일치합니다. |
| `placeholder` | `string` | `messages.placeholder` | 빈 문서 안내 문구. 백틱으로 감싼 부분(`` `/` ``)은 키 모양으로 그립니다 |

### 툴바 컴포넌트

넓은 화면(> 640px)에서만 표시됩니다.

| 컴포넌트 | props | 내용 |
| --- | --- | --- |
| `<Toolbar>` | `className?`, `extra?` | `<InsertRow>` + `<FormatRow>`. `extra`는 `<InsertRow>`로 전달됩니다. |
| `<InsertRow>` | `className?`, `extra?` | 이미지, 이미지 행, 동영상, 임베드 \| 인용, 구분선, 코드 블록, 표 \| 링크 |
| `<FormatRow>` | `className?` | 블록 유형 선택 \| 굵게, 기울임, 밑줄, 취소선 \| 정렬 \| 글머리 목록, 번호 목록, 체크리스트 \| 링크 |
| `<InsertButton>` | `icon`, `label`, `onClick`, `expanded?` | 삽입 줄과 같은 모양의 버튼(아이콘 위, 레이블 아래). `extra`에 앱의 버튼을 넣을 때 씁니다. `expanded`는 `aria-expanded`로 반영되고, 버튼이 연 패널이 열려 있는 동안 눌린 배경으로 표시됩니다. mousedown에서 포커스를 가져가지 않으므로 본문 선택 영역이 유지됩니다. |
| `<FloatingToolbar>` | `anchorRef` (필수) | 선택 영역 위에 뜨는 서식 툴바. 기본 구성에 포함되지 않습니다. `anchorRef`는 위치 계산 기준이 되는 `position: relative` 요소입니다. |

`extra`는 삽입 줄 마지막 그룹 뒤에 구분선을 두고 렌더링됩니다.

토글 버튼은 `aria-pressed`로 현재 선택 영역의 상태를 반영합니다. 목록 버튼과 인용·코드 블록 버튼은 이미 그 유형인 블록에서 다시 누르면 문단으로 되돌립니다. 블록 유형 선택 메뉴에서 현재 유형을 다시 고르면 변화가 없습니다.

### `<MobileBar>`

좁은 화면(≤ 640px)에서만 표시됩니다. `visualViewport`로 가상 키보드 높이를 계산해 키보드 바로 위에 고정됩니다. 기본 버튼은 이미지, 서식, 글머리 목록, 인용, 더 보기입니다.

| prop | 타입 | 설명 |
| --- | --- | --- |
| `end` | `ReactNode` | 오른쪽 끝 요소. 저장 버튼 등 |
| `count` | `ReactNode` | `end` 앞의 짧은 텍스트. 글자 수 등 |
| `className` | `string` | 루트 요소의 클래스 |
| `panels` | `MobilePanel[]` | 앱이 추가하는 패널. 버튼은 인용과 더 보기 사이에 놓입니다. |

```ts
type MobilePanel = {
  id: string;
  icon: ReactNode;
  label: string; // aria-label
  render: (api: {
    close: () => void;
    atCursor: (run: () => void) => void;
  }) => ReactNode;
};
```

패널이 열리면 가상 키보드가 닫혀 있습니다. 본문을 바꾸려면 `atCursor`로 감싸세요. 패널을 열기 직전의 선택 영역을 복원한 `editor.update` 안에서 `run`을 실행합니다. `atCursor` 없이 `editor.update`를 호출하면 선택 영역이 없어 문서 끝에 삽입됩니다.

서식과 더 보기 버튼은 가상 키보드를 닫고 그 자리에 패널을 엽니다. 패널에서 실행한 명령은 패널을 열기 직전의 선택 영역에 적용됩니다. 본문에 포커스가 돌아오면 패널이 닫힙니다.

### `MediaAdapter`

```ts
type MediaAdapter = {
  upload: (file: File, options: UploadOptions) => Promise<string>; // 공개 URL
  limits?: Partial<MediaLimits>;
};

type UploadOptions = {
  kind: "image" | "video";
  /** 이 파일이 더 이상 필요 없을 때 끊깁니다 — 본문에서 지웠거나 화면을 떠났을 때 */
  signal: AbortSignal;
  onProgress?: (percent: number) => void;
};

type MediaLimits = Record<"image" | "video", { types: string[]; maxBytes: number }>;
```

`limits`는 삽입 시점의 파일 검증에 쓰입니다. 서버의 업로드 제한과 같은 값을 넘기세요. 검증 실패는 `onNotify`로 전달되고 파일은 삽입되지 않습니다.

기본값(`DEFAULT_LIMITS`):

| kind | MIME 타입 | 최대 크기 |
| --- | --- | --- |
| `image` | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif` | 10 MB |
| `video` | `video/mp4`, `video/webm` | 100 MB |

`video/quicktime`(MOV)은 별도 메시지(`messages.validate.videoMov`)로 거부합니다. iOS에서 촬영한 MOV는 대부분 HEVC여서 브라우저마다 재생 여부가 다릅니다.

동영상 업로드에서 `onProgress`를 호출하면 에디터에 진행률 바가 표시됩니다.

`signal` 을 요청에 그대로 넘기세요. 사용자가 사진을 지우거나 화면을 떠나면 에디터가 여기를 끊습니다. 끊긴 요청의 실패는 화면에 띄우지 않습니다.

### `sanitizeHtml`

```ts
import { sanitizeHtml } from "@avarlabs/editor/sanitize";

sanitizeHtml(html: string, options?: SanitizeOptions): string

type SanitizeOptions = {
  /** 태그 → 허용 속성. 같은 태그를 주면 속성이 합쳐집니다 */
  tags?: Record<string, Array<string>>;
  /** class 값으로 통과시킬 이름 */
  classes?: RegExp;
  /** iframe src 로 받아 줄 주소 */
  iframeSrc?: Array<RegExp>;
};
```

`options` 는 기본 허용 목록을 **넓히기만** 합니다. 좁히는 쪽은 실수해도 조용해서 열지 않았습니다. `<Editor nodes={…}>` 로 커스텀 노드를 등록했다면 그 노드가 내보내는 태그와 클래스를 여기에 같이 알려야 합니다.

에디터 노드가 `exportDOM`으로 출력하는 태그·속성·클래스만 허용합니다. React를 불러오지 않는 별도 엔트리이고, 문자열 파서(`xss`) 기반이라 DOM이 없는 환경에서 동작합니다.

주요 규칙은 다음과 같습니다. 전체 허용 목록은 `src/format/sanitize.ts`에 있습니다.

- `class`는 `editor-*`, `image-row`, `image-row-track`, `embed`, `embed-frame`, `divider` 토큰만 남깁니다. 앱의 유틸리티 클래스로 화면 전체를 덮는 요소를 만드는 것을 막습니다.
- `style`은 `text-align`, `white-space: pre-wrap`, 이미지 행의 `flex`, 들여쓰기용 `padding-inline-start`만 값의 형식까지 검사해 남깁니다.
- `href`는 `http:`, `https:`, `mailto:`, `#`만, `img`·`video`의 `src`는 `http:`, `https:`만 허용합니다. 스킴 검사 전에 HTML 엔티티와 제어 문자를 해석하므로 `&#106;avascript:` 같은 우회도 막습니다.
- `iframe`은 YouTube(`www.youtube-nocookie.com/embed/{11자 ID}`)와 Vimeo(`player.vimeo.com/video/{숫자 ID}`) 형식만 남깁니다.
- `target`은 `_blank`만 허용하며, `rel`에 `noopener`가 없으면 `rel="noopener noreferrer"`를 추가합니다.

### 훅과 유틸리티

`<Editor>` 안에서 직접 컴포넌트를 만들 때 사용합니다.

```tsx
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { insert, useEditorEnv } from "@avarlabs/editor";

function InsertImageButton() {
  const [editor] = useLexicalComposerContext();
  const env = useEditorEnv();
  return (
    <button type="button" onClick={() => void insert(editor, env, "image")}>
      {env.messages.insert.image}
    </button>
  );
}
```

| export | 시그니처 | 설명 |
| --- | --- | --- |
| `insert` | `(editor, env, id: InsertId, options?) => Promise<void>` | 모든 삽입 UI가 공유하는 삽입 함수. 커서가 빈 문단에 있으면 그 문단 자리에 블록을 넣습니다. |
| `setBlock` | `(editor, id: BlockId) => void` | 블록 유형 변경. 현재와 같은 유형이면 문단으로 되돌립니다. |
| `useEditorEnv` | `() => EditorEnv` | `{ messages, limits, media, notify, askUrl }` |
| `useMessages` | `() => EditorMessages` | 현재 메시지 |
| `normalizeUrl` | `(input: string) => string \| null` | 링크 URL 정규화. 스킴이 없으면 `https://`를 붙이고, 허용 스킴 외에는 `null`을 반환합니다. |
| `parseEmbed` | `(url: string) => { provider, id } \| null` | YouTube·Vimeo URL 파서 |
| `measureText` | `(text: string) => EditorStats` | 공백 제외 글자 수와 예상 읽기 시간(한글 분당 500자, 영문 분당 200단어) |
| `readEditorContent` | `(editor: LexicalEditor) => EditorContent` | Lexical 인스턴스 직접 직렬화 |
| `editorNodes`, `editorTheme`, `TRANSFORMERS` | — | 헤드리스 Lexical 인스턴스 구성용 |
| `DividerNode`, `$createDividerNode`, `$isDividerNode`, `DIVIDER_VARIANTS`, `INSERT_DIVIDER_COMMAND` | — | 구분선 노드, 변형 목록, 삽입 커맨드 |
| `$insertMedia` | `(items: MediaRef[], layout: MediaLayout, at?: number) => void` | `editor.update` 안에서 호출하는 삽입 함수. `at`을 주면 커서 대신 최상위 블록 `at`번째 앞에 삽입합니다. |
| `canLayoutAsRow` | `(items: MediaRef[]) => boolean` | 이미지 행으로 묶을 수 있는지. 이미지 2장 이상이고 동영상이 없어야 합니다. |
| `setMediaDragData`, `MEDIA_DRAG_TYPE` | — | 드래그 소스용. [드래그 앤 드롭](#드래그-앤-드롭) 참고 |
| `listMediaSrcs` | `(editor: LexicalEditor) => Set<string>` | 문서의 이미지·동영상 URL |
| `UploadError`, `MissingFileError` | `class` | 업로드 오류 |
| `ko`, `en` | `EditorMessages` | 내장 메시지 |

```ts
type BlockId = "paragraph" | "h1" | "h2" | "h3" | "quote" | "bulletList" | "numberList" | "checkList" | "code";
type InsertId = "image" | "imageRow" | "video" | "embed" | "quote" | "divider" | "code" | "table" | "link";
```

그 밖에 export되는 타입은 `EditorProps`, `EditorContent`, `EditorStats`, `EditorMessages`, `MediaAdapter`, `MediaLimits`, `MediaLimit`, `MediaKind`, `UploadFile`, `UploadProgress`, `Embed`, `DividerVariant`, `MediaRef`, `MediaLayout`, `MobilePanel`입니다.

## 미디어 라이브러리 연동

`MediaAdapter`는 파일을 문서에 넣는 경로입니다. 이미 업로드된 파일 목록(앱의 미디어 라이브러리, 에셋 보관함 등)에서 꺼내 넣을 때는 파일 대신 URL을 넘깁니다. 업로드 대기열(`save()`의 업로드 단계)을 거치지 않습니다.

```ts
type MediaRef = {
  kind: "image" | "video";
  src: string;     // http(s) URL
  alt?: string;    // 이미지 대체 텍스트
  width?: number;  // 원본 크기. 이미지 행의 폭 분배에 사용
  height?: number;
};
type MediaLayout = "sequence" | "row";
```

| 레이아웃 | 결과 |
| --- | --- |
| `sequence` | 항목마다 이미지·동영상 블록을 순서대로 삽입합니다. |
| `row` | 이미지를 이미지 행으로 묶습니다. 행당 최대 3장이며, 넘치면 행 수를 먼저 정해 고르게 나눕니다(4장 → 2+2). 한 장만 남는 행은 단일 이미지로 삽입합니다. `canLayoutAsRow(items)`가 `false`(이미지가 2장 미만이거나 동영상 포함)면 `sequence`로 삽입합니다. |

### 클릭 삽입

```tsx
handleRef.current?.insertMedia([{ kind: "image", src, alt, width, height }], "sequence");
```

라이브러리 UI의 버튼은 mousedown 기본 동작을 막아(`event.preventDefault()`) 본문 포커스를 유지하세요. 그래야 커서 위치에 삽입됩니다.

좁은 화면 패널(`MobilePanel`)에서는 `atCursor`와 `$insertMedia`를 씁니다.

```tsx
render: ({ atCursor, close }) => (
  <button onClick={() => { atCursor(() => $insertMedia(items, "row")); close(); }}>넣기</button>
)
```

### 드래그 앤 드롭

`<Content>`는 `MEDIA_DRAG_TYPE`(`application/x-le-media+json`) 데이터를 받습니다. 드래그 소스의 `dragstart`에서 `setMediaDragData`를 호출하세요.

```tsx
<button
  draggable
  onDragStart={(event) => setMediaDragData(event.dataTransfer, [ref], "sequence")}
/>
```

드래그하는 동안 포인터 높이에 가장 가까운 최상위 블록 경계에 삽입선(`.le-drop-line`, 색은 `--editor-accent`)을 표시하고, 드롭하면 그 위치에 삽입합니다. 블록의 위쪽 절반이면 그 앞, 아래쪽 절반이면 그 뒤입니다. 본문 아래 빈 영역에 드롭하면 문서 끝에 추가합니다. 수신 측은 페이로드의 형태를 검사하고 `http:`·`https:` URL만 받습니다.

이벤트는 캡처 단계에서 처리하고 전파를 중단합니다. Lexical 기본 드롭 처리(텍스트 이동)는 이 데이터에 실행되지 않습니다.

### 삽입된 미디어 확인

`listMediaSrcs(editor: LexicalEditor): Set<string>`은 문서의 이미지·동영상 URL을 반환합니다. 이미지 행 안의 이미지도 한 장씩 포함합니다. 라이브러리에서 "이 글에 있음"을 표시할 때 `registerUpdateListener`와 함께 쓰세요.

```ts
const editor = handleRef.current?.lexical();
const unregister = editor?.registerUpdateListener(() => setUsed(listMediaSrcs(editor)));
```

## 저장 파이프라인

삽입 시점에 `limits`로 파일을 검증하고, 문서에는 blob URL 미리보기를 넣습니다. 이미지 2장 이상을 한 번에 넣으면 이미지 행으로 묶습니다. 한 행은 최대 3장이고, 넘치면 행 수를 늘려 고르게 나눕니다(4장은 2+2, 5장은 3+2).

편집 중에는 업로드하지 않습니다. 문서에서 삭제한 파일은 업로드 대상에서 빠집니다.

`save()`는 문서 순서대로 미리보기 URL을 모아 업로드하고 공개 URL로 교체한 뒤 직렬화합니다. 표 셀과 이미지 행 내부까지 탐색합니다. 업로드가 끝난 URL은 기억해 두므로 실행 취소로 이전 미리보기가 문서에 돌아와도 다시 업로드하지 않습니다. URL 교체는 별도 실행 취소 단계로 남지 않고(직전 단계에 병합) 자동 저장도 트리거하지 않습니다.

파일이 사라진 미리보기 URL은 문서에서 제거하고 `dropped`로 셉니다. 남겨 두면 이후 모든 저장이 실패하기 때문입니다.

## 자동 저장

`onAutoSave`는 편집이 멈춘 뒤 한 번 호출됩니다. 호출 조건은 다음과 같습니다.

- 편집마다 타이머를 초기화하고 `autoSaveDelay` 동안 추가 편집이 없으면 호출합니다.
- 타이머가 끝났을 때 IME 조합 중이면 한 번 더 기다립니다.
- 선택 영역만 바뀐 업데이트는 편집으로 보지 않습니다.
- `initial`로 불러온 초기 상태와 플러그인 등록 시 적용되는 노드 트랜스폼은 트리거하지 않습니다.

새 문서가 빈 채로 생성되지 않게 하려면 `save()` 전에 `handle.read().plainText`를 확인하세요. 이미 저장된 문서에 같은 검사를 걸면 본문을 모두 지운 변경이 저장되지 않습니다.

## 입력

| 입력 | 결과 |
| --- | --- |
| `/` | 슬래시 메뉴. 한글·영문 키워드로 검색합니다(`/제목`, `/h1`, `/사진`, `/table`). |
| 블록 삽입 버튼(`+`) | 삽입 메뉴. 구분선은 하위 메뉴에서 변형을 고릅니다. |
| `#`–`######` + 공백 | 헤딩 |
| `-`, `*` + 공백 / `1.` + 공백 / `[]` + 공백 | 글머리 목록 / 번호 목록 / 체크리스트 |
| `>` + 공백 | 인용 |
| ` ``` ` | 코드 블록 |
| `---`, `***`, `___` | 구분선(`line`) |
| `**굵게**`, `*기울임*`, `~~취소선~~`, `` `코드` `` | 텍스트 서식. 한글은 조합이 확정된 뒤 적용됩니다. |
| `[텍스트](url)`, `![대체 텍스트](url)` | 링크, 이미지 |
| 이미지 드롭·붙여넣기 | 1장이면 이미지, 2장 이상이면 이미지 행 |
| 빈 문단에 YouTube·Vimeo URL 붙여넣기 | 임베드. 텍스트가 있는 문단에서는 일반 텍스트로 처리합니다. |
| `Tab` | 들여쓰기 |

IME 조합 중에는 자동 저장, 글자 수 계산, 플로팅 툴바, 블록 삽입 버튼이 멈춥니다. 마크다운 단축키 목록은 `TRANSFORMERS`로 export됩니다.

## i18n

모든 UI 문구는 `EditorMessages` 객체에서 가져옵니다. `ko`(기본)와 `en`이 내장되어 있으며, 일부만 바꾸려면 스프레드로 덮어쓰세요.

```tsx
import { type EditorMessages, ko } from "@avarlabs/editor";

const messages: EditorMessages = {
  ...ko,
  placeholder: "무엇이든 적어 보세요.",
  media: { ...ko.media, uploadFailed: "업로드에 실패했습니다. 네트워크를 확인하세요." },
};
```

| 그룹 | 내용 |
| --- | --- |
| `placeholder`, `crashed` | 빈 문서 안내, 에디터 오류 |
| `blocks`, `insert`, `hints` | 블록 유형 이름, 삽입 항목 이름, 슬래시 메뉴 설명 |
| `format`, `divider` | 서식·정렬·링크 버튼 레이블, 구분선 변형 이름 |
| `media` | 캡션 placeholder, 업로드 상태, 이미지 행 조작, 임베드 링크 문구, 업로드 오류 |
| `url`, `validate` | URL 입력 팝오버, 파일 검증 오류 |
| `stats`, `mobile` | 글자 수·읽기 시간 표기, 모바일 패널 안내 |

저장되는 HTML에 들어가는 문구도 지정한 언어를 따릅니다. 캡션 없는 임베드의 원본 링크 문구가 여기 해당합니다.

## 테마

에디터 CSS는 색을 모두 `--editor-*` 커스텀 속성으로 참조합니다. 기본값은 `:where(:root)`에 선언되어 명시도가 0이므로 앱의 어느 선택자에서든 덮어쓸 수 있습니다.

```css
:root {
  --editor-fg: var(--foreground);
  --editor-accent: var(--brand);
}
```

| 속성 | 기본값 | 사용처 |
| --- | --- | --- |
| `--editor-fg` | `#18181b` | 텍스트, 아이콘, 모바일 툴바 활성 버튼 배경 |
| `--editor-muted` | `#71717a` | 보조 텍스트, 캡션, 인용 |
| `--editor-line` | `#e4e4e7` | 테두리, 구분선(`line`), 표 셀 |
| `--editor-soft` | `#f4f4f5` | 활성 버튼, 코드 배경, 모바일 패널 |
| `--editor-bg` | `#ffffff` | 툴바, 블록 삽입 버튼, 입력 필드 |
| `--editor-popover` | `#ffffff` | 메뉴, 팝오버 |
| `--editor-primary` / `--editor-primary-fg` | `#18181b` / `#fafafa` | 체크된 체크리스트 항목, 팝오버 확인 버튼 |
| `--editor-accent` | `#be5737` | 동영상 업로드 진행률 바, 표 셀 선택 |
| `--editor-ring` | `#a1a1aa` | 선택된 노드 외곽선 |
| `--editor-divider` | `#a1a1aa` | 구분선(`short`, `dots`, `diamond`) |
| `--editor-radius` | `12px` | 이미지·메뉴 모서리 |
| `--editor-mono` | `ui-monospace, …` | 코드 글꼴 |
| `--editor-shadow` | `0 12px 32px rgb(0 0 0 / 0.14)` | 메뉴 그림자 |

글꼴 종류와 글자 크기를 바꾸는 기능은 제공하지 않습니다. 본문 타이포그래피는 렌더링하는 앱이 결정합니다.

코드 하이라이팅 토큰 색은 커스텀 속성이 아니라 `.editor-token-*` 클래스에 있습니다. 다크 테마에서는 앱이 이 클래스를 덮어쓰세요.

| 스타일시트 | 용도 |
| --- | --- |
| `styles/editor.css` | 편집 화면. `reader.css`를 `@import`합니다. |
| `styles/reader.css` | 읽기 화면. 이미지 행, 임베드 프레임, 구분선 변형, 표만 정의합니다. |

## 직렬화 형식

| `type` | 직렬화 필드 | HTML 출력 |
| --- | --- | --- |
| `image` | `src`, `altText`, `caption` | `<figure><img loading="lazy"><figcaption>` |
| `image-row` | `images: { src, altText, width, height }[]`, `caption` | `<figure class="image-row"><div class="image-row-track"><img style="flex: {비율} 1 0%">…` |
| `video` | `src`, `caption` | `<figure><video controls playsinline preload="metadata">` |
| `embed` | `provider`, `videoId`, `caption` | `<figure class="embed"><div class="embed-frame"><iframe>` + 원본 링크 |
| `divider` | `variant` | `<hr class="divider" data-variant="{variant}">` |
| `table`, `tablerow`, `tablecell` | Lexical 기본 | `<table class="editor-table">`. 첫 행이 헤더 셀입니다. |
| `paragraph`, `heading`, `quote`, `list`, `listitem`, `code`, `code-highlight`, `link`, `autolink` | Lexical 기본 | 정렬은 `style="text-align: …"`로 출력됩니다. |

이미지 행은 각 이미지의 `flex-grow`를 가로세로 비율(0.5–2.5로 제한)로, `flex-basis`를 0으로 두어 행 안의 높이를 맞춥니다. 원본 크기를 알 수 없으면 1:1로 계산합니다.

임베드는 URL이 아니라 검증된 `provider`와 `videoId`만 저장하고 `iframe`의 `src`는 노드가 조립합니다. `iframe`과 `video`는 `importDOM`을 정의하지 않으므로 붙여넣은 HTML로는 생성되지 않습니다.

구분선 변형은 `DIVIDER_VARIANTS`(`["line", "short", "bold", "dots", "diamond"]`)입니다. 변형마다 다른 태그를 쓰지 않고 `<hr data-variant>` 하나로 출력하므로 `reader.css`가 없는 RSS 리더나 이메일에서도 가로선은 표시됩니다.

업로드 상태와 진행률은 직렬화하지 않습니다.

### 마이그레이션

현재 자동 변환은 `horizontalrule`에서 `divider`(`line`)로 가는 경로 하나뿐입니다.

등록되지 않은 노드 타입이 저장된 문서에 있으면 Lexical이 문서를 불러오지 못합니다. 노드를 제거하거나 이름을 바꿀 때는 제거하기 전에 기존 문서를 변환하세요. 기존 노드가 등록된 `editorNodes`로 헤드리스 인스턴스를 만들어 문서를 불러오고, 노드를 교체한 뒤 다시 직렬화합니다. 노드를 먼저 제거하면 기존 문서를 파싱할 수 없습니다.

`html`도 다시 만들려면 `$generateHtmlFromNodes`가 DOM을 요구하므로 jsdom 같은 DOM 구현이 필요합니다. happy-dom에서는 표가 출력되지 않습니다(Lexical 0.50 기준).

## 알려진 제약

- 직렬화 형식의 버전 필드와 마이그레이션 API가 없습니다. 수동 변환 방법은 [마이그레이션](#마이그레이션)을 참고하세요.
- 화면 폭 브레이크포인트(640px)가 CSS 미디어 쿼리에 고정되어 있습니다. `--editor-narrow`는 선언만 되어 있고 적용되지 않습니다.
- `media`를 지정하지 않아도 삽입 툴바의 이미지·동영상 버튼이 표시되며, 눌러도 동작하지 않습니다.
- 표의 행·열 추가와 셀 병합 UI가 없습니다. 표는 3×3(첫 행 헤더)으로 생성됩니다.
- 임베드는 YouTube와 Vimeo만 기본 지원합니다. 다른 곳은 `sanitizeHtml` 의 `iframeSrc` 로 열 수 있지만, 에디터에서 넣는 UI 는 아직 없습니다.
- 업로드 결과로 이미지 크기나 에셋 id 를 돌려받을 수 없습니다. `upload` 는 공개 URL 문자열만 받습니다.
- 툴바 항목은 골라 넣을 수 없습니다. 기본 구성을 쓰거나 통째로 새로 짜야 합니다.
- CSS 가 `@layer` 없이 전역 선택자입니다. 앱의 리셋과 우선순위가 부딪힐 수 있습니다.
- 아이콘은 내장 SVG이며 교체할 수 없습니다.
- `<MobileBar>`의 가상 키보드 추적은 모바일 에뮬레이션에서만 확인했습니다. 실제 iOS·Android 기기 검증이 필요합니다.

기여와 내부 구조는 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 라이선스

MIT

아이콘 도형은 [Lucide](https://lucide.dev)(ISC)에서 가져왔습니다. 저작권 고지는 `src/ui/icons.tsx`에 있습니다.
