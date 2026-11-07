# 001. TypeScript + Vite + Vitest(jsdom) 사용

- 상태: Accepted
- 날짜: 2026-11-07

## 맥락

과제는 HTML·CSS·JS(또는 TS) Vanilla만 허용하고 React·Vue 같은 외부 프레임워크를 금지한다. 팀은 TypeScript로 합의했다. 브라우저는 TS를 직접 실행하지 못하고, VDOM 변환·Diff·Patch·Hooks는 단위 테스트로 검증해야 한다.

## 결정

- 언어는 TypeScript로 한다.
- 개발 서버와 TS 변환은 Vite(`vanilla-ts` 템플릿)를 쓴다.
- 단위 테스트는 Vitest, DOM이 필요한 테스트는 jsdom 환경에서 실행한다.
- 패키지 관리는 npm을 쓴다.

Vite·Vitest·jsdom은 개발·테스트 도구라서 결과물에 UI 프레임워크가 포함되지 않는다. 그래서 과제 제약에 걸리지 않는다. `tsc`만 쓰는 구성보다 저장 즉시 반영되는 개발 서버와, Vite 설정을 그대로 공유하는 테스트 도구를 얻을 수 있다.

## 결과

- 화면 코드와 코어 로직을 모두 타입과 함께 작성하고, 브라우저 없이 테스트할 수 있다.
- `node_modules`와 설정 파일이 생기고, 빌드 단계를 이해해야 한다.
- 빌드 도구 사용도 금지로 해석되면 `tsc` 단독 구성으로 바꾼다. 코어 코드는 그대로 두고 설정만 바꾼다.
