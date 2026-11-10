# 007. 이벤트는 루트에서 받아 VDOM의 핸들러를 부른다

- 상태: Accepted
- 날짜: 2026-11-10

## 맥락

Phase 1의 VNode `props`는 문자열만 담고, diff와 patch는 문자열 속성만 다룬다. Phase 2에서는 클릭·입력 핸들러 함수가 필요하다.

컴포넌트 함수는 렌더마다 다시 실행되어 핸들러도 매번 새 함수가 된다. 옛 함수가 DOM에 남으면 옛 state를 보고 동작한다.

## 결정

- 핸들러는 VNode의 `events` 필드에 둔다. `props`와 섞지 않는다.
- diff와 patch는 `events`를 보지 않는다.
- `FunctionComponent`가 컨테이너에 리스너를 한 번만 건다. 이벤트가 오면 대상 DOM 노드의 자식 번호를 따라 지금 VDOM의 노드를 찾고, 안쪽부터 바깥으로 핸들러를 부른다.

## 버린 대안

- 노드마다 `addEventListener`: 렌더마다 모든 핸들러가 "변경"으로 잡혀 연산 목록이 핸들러 교체로 채워지고, diff·patch·render에 함수 처리가 들어간다.
- `props`에 함수 허용: `Record<string, string>`에 기대는 HTML 왕복(render, dom-to-vnode)의 타입이 깨진다.

## 결과

- Phase 1 코어를 고치지 않고 항상 최신 핸들러가 불린다.
- 실제 DOM과 VDOM의 자식 순서가 1:1이어야 한다. patch의 경로 규칙과 같은 전제다.
- focus·blur처럼 버블링하지 않는 이벤트는 받지 못한다. 받을 이벤트는 `DELEGATED_EVENTS`에 추가한다.
