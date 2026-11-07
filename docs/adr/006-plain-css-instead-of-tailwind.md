# 006. 디자인 시안의 Tailwind 대신 순수 CSS

- 상태: Accepted
- 날짜: 2026-11-07

## 맥락

메모 보드 디자인 시안(`code.html`)은 Tailwind CDN 스크립트로 스타일을 입히고, 요소마다 긴 유틸리티 클래스를 쓴다. 과제 기술 스택은 Vanilla HTML·CSS·JS(TS)다. Phase 1에서는 실제 영역의 HTML이 테스트 영역 textarea에 그대로 들어가고, 사용자가 이 소스를 직접 고친다.

## 결정

- Tailwind를 쓰지 않고 순수 CSS로 다시 작성한다.
- 시안 `DESIGN.md`의 색·간격은 CSS 변수로 옮긴다.
- 클래스는 `.note`, `.note--yellow`처럼 짧은 의미 단위로 쓴다.

Tailwind CDN은 런타임 스크립트라서 "Vanilla CSS" 제약 위반으로 볼 여지가 있고, 공식 문서도 개발용으로 안내한다. 긴 클래스 문자열은 textarea 편집과 diff 결과를 읽기 어렵게 만든다.

## 결과

- 과제 제약 해석에 논란이 없고, textarea 소스가 짧고 읽기 쉽다.
- 시안의 세부 질감(SVG 필터 등)은 CSS 배경으로 단순화하므로 시안과 똑같지는 않다.
- 스타일을 직접 관리해야 해서 CSS 코드량이 늘어난다.
