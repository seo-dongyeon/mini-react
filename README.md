# mini-react
Krafton Jungle SW-AI Lab Week11~12 mini-react project

Virtual DOM · Diff · Patch(Phase 1)와 Component · State · Hooks(Phase 2)를 프레임워크 없이 TypeScript로 구현한다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173, Phase 2는 /phase2.html)
npm test         # 단위·왕복 테스트 + 기능 테스트
npm run build    # 타입 검사 + 빌드
```

## Phase 1 동작 (index.html)

- 로드: 실제 영역의 샘플 HTML → Virtual DOM → 테스트 영역(textarea)에 HTML 소스로 렌더링한다.
- Patch: textarea 소스 → Virtual DOM → 이전 Virtual DOM과 diff → 바뀐 부분만 실제 영역에 patch → 기록에 추가한다. 바뀐 부분이 없으면 기록하지 않는다.
- 뒤로가기·앞으로가기: 브라우저 방문 기록과 같다. 뒤로 간 상태에서 새로 Patch하면 앞쪽 기록은 버린다. 실제 영역은 diff/patch로 부분 갱신하고 textarea는 그 시점 소스로 다시 채운다.
- 목록 항목에 `data-key`를 붙이면 순서가 바뀔 때 노드를 새로 만들지 않고 옮긴다. diff가 옮기라고 한 노드만 움직이고 제자리 노드는 건드리지 않는다.
- 줄바꿈이 섞인 공백만 있는 텍스트는 들여쓰기로 보고 버린다. 단 `pre`·`textarea` 안의 공백과 첫 개행은 내용으로 보존한다.
- `<script>` 같은 위험한 태그, `on*` 속성, `javascript:` URL은 제거하고 경고를 보여준다.
- Patch와 기록 이동 때마다 diff 연산 목록, MutationObserver로 센 실제 DOM 변경 횟수, 지금 Virtual DOM 트리를 보여준다. 바뀐 DOM은 노랗게 깜빡인다.
- 예제 버튼은 소스를 대신 고치고 Patch한다: 텍스트·속성·항목 추가/삭제·태그 교체·key 목록 돌리기(MOVE 1개)·key 없는 목록 돌리기(TEXT 여러 개).

## Phase 2 동작 (phase2.html)

- `FunctionComponent(fn, container)`: `hooks` 배열에 상태를 두고 `mount()`로 처음 그리고 `update()`로 다시 그린다. `update()`는 함수 재실행 → diff → patch → effect 순서다.
- 훅은 호출 순서(`hooks[n]`)로 자기 칸을 찾는다. 칸의 종류가 달라지거나 개수가 늘거나 줄면 에러를 낸다. 같은 종류의 훅끼리 순서만 바뀐 경우는 알아채지 못한다.
- 훅은 루트 컴포넌트에서만 쓴다. `h(Child, props)`로 부른 자식 안이나 렌더 밖에서 부르면 에러를 낸다. 자식은 props만 받는 순수 함수이고, 상태를 바꾸려면 부모가 준 콜백을 부른다.
- `useState`: 같은 값(`Object.is`)이면 무시한다. 아니면 값을 바꾸고 렌더를 마이크로태스크로 예약한다. 한 이벤트 안의 여러 setState는 렌더 1번으로 묶인다. `setState(prev => next)` 형태를 받는다.
- `useEffect`: patch가 끝난 직후 동기로 실행한다. deps가 같으면 건너뛰고, 다시 실행하기 전에 지난 cleanup을 부른다. deps가 없으면 매 렌더, `[]`이면 처음 한 번.
- `useMemo`: deps가 같으면 지난 값을 돌려준다.
- `h(tag, props, ...children)`: `onClick` 같은 함수는 `events`로, `key`는 `vnode.key`와 `data-key` 속성으로 간다. `false`·`null`·`undefined` 자식은 그리지 않는다.
- 이벤트: 컨테이너 하나가 click·input·change·keydown·submit을 받아 지금 VDOM에서 핸들러를 찾아 부른다. diff·patch는 핸들러를 다루지 않는다. 버블링하지 않는 이벤트(focus, blur)는 받지 못한다.
- 실습 페이지는 hooks 배열의 지금 값, 일어난 순서(setState → render → useMemo → diff/patch → effect), 마지막 diff 연산을 보여준다.

### 실제 React와 다른 점

- 상태는 루트 하나에만 있다. React는 컴포넌트마다 자기 hooks를 갖고, 바뀐 컴포넌트부터 다시 그린다.
- 자식 컴포넌트는 `h` 호출 시점에 바로 실행되어 VNode로 펼쳐진다. React는 컴포넌트 경계를 트리(Fiber)에 남긴다.
- effect를 patch 직후 동기로 실행한다. React는 보통 브라우저가 화면을 그린(Paint) 뒤 실행하지만, 클릭 같은 상호작용에서 시작된 effect는 그리기 전에 실행할 수도 있다. "DOM에 반영됨"과 "화면에 그려짐"은 다른 단계다.
- 렌더를 중간에 멈추거나 우선순위를 나누지 않는다. unmount와 그때의 cleanup도 없다.

## 구조

```
src/core/        vnode, dom-to-vnode, sanitize, render, diff, patch   (Phase 1)
                 h, component (FunctionComponent, useState, useEffect, useMemo)   (Phase 2)
src/playground/  Phase 1 페이지: main, history / inspect (두 페이지가 같이 쓰는 표시 도구)
src/phase2/      Phase 2 페이지: app (실습 컴포넌트), main (mount + 내부 패널)
tests/           모듈별 단위 테스트 + page.test.ts · phase2-page.test.ts 기능 테스트
docs/adr/        설계 결정 기록
```
