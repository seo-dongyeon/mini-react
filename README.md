# mini-react
Krafton Jungle SW-AI Lab Week11~12 mini-react project

Virtual DOM · Diff · Patch(Phase 1)와 Component · State · Hooks(Phase 2)를 프레임워크 없이 TypeScript로 구현한다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm test         # 단위·왕복 테스트 + 기능 테스트
npm run build    # 타입 검사 + 빌드
```

## Phase 1 동작 (Playground)

- 로드: 실제 영역의 샘플 HTML → Virtual DOM → 테스트 영역(textarea)에 HTML 소스로 렌더링한다.
- Patch: textarea 소스 → Virtual DOM → 이전 Virtual DOM과 diff → 바뀐 부분만 실제 영역에 patch → 기록에 추가한다. 바뀐 부분이 없으면 기록하지 않는다.
- 뒤로가기·앞으로가기: 브라우저 방문 기록과 같다. 뒤로 간 상태에서 새로 Patch하면 앞쪽 기록은 버린다. 실제 영역은 diff/patch로 부분 갱신하고 textarea는 그 시점 소스로 다시 채운다.
- 목록 항목에 `data-key`를 붙이면 순서가 바뀔 때 노드를 새로 만들지 않고 옮긴다.
- `<script>` 같은 위험한 태그, `on*` 속성, `javascript:` URL은 제거하고 경고를 보여준다.
- Patch와 기록 이동 때마다 diff 연산 목록과, MutationObserver로 센 실제 DOM 변경 횟수를 보여준다.
- 샘플 메모에는 제목·문단·링크·key 목록·번호 목록·표·체크박스·입력칸·버튼·인용이 들어 있다.

## 구조

```
src/core/        vnode, dom-to-vnode, sanitize, render, diff, patch  (Phase 2에서 재사용)
src/playground/  history, main (화면 연결)
tests/           모듈별 단위 테스트 + patch 왕복 테스트 + page.test.ts 기능 테스트
docs/adr/        설계 결정 기록
```
