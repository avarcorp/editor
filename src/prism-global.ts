/**
 * Prism 코어를 언어 파일보다 먼저 실행해 전역에 올린다.
 *
 * prismjs/components/* 는 전역 `Prism` 이 이미 있다고 가정하는 스크립트다.
 * `import "prismjs"` 뒤에 두기만 해서는 순서가 지켜지지 않는다.
 * - Rolldown(Vite 8) 은 CJS 코어를 호출 시점에 도는 래퍼로 감싸고, 언어 파일은
 *   청크 최상위로 끌어올려 코어보다 먼저 돌린다.
 * - Node 에서는 @lexical/code-prism 이 top-level await 로 실제 모듈을 부르므로,
 *   그 뒤의 형제 import(언어 파일)가 코어를 기다리지 않고 먼저 평가된다.
 *
 * 그래서 index.ts 의 첫 import 로 두고, 바인딩을 실제로 써서 이 자리에서 코어가
 * 돌게 한다. package.json 의 sideEffects 에 이 파일과 index.js 가 함께 있어야
 * 번들러가 떼어 내지 않는다.
 */
import * as Prism from "prismjs";

// 브라우저와 Node 모두 코어가 스스로 전역에 올리므로, 없을 때만 채운다
(globalThis as { Prism?: unknown }).Prism ??= Prism;
