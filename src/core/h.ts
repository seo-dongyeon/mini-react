import { renderChild } from './component'
import { KEY_ATTR, type VElement, type VNode } from './vnode'

/** 자식 자리에 쓸 수 있는 값. false·null·undefined는 그리지 않는다(조건부 렌더링용). 배열은 펼친다(map 결과용). */
export type Child = VNode | string | number | boolean | null | undefined | Child[]

type Handler = (event: Event) => void
export type PropValue = string | number | boolean | null | undefined | Handler
export type Props = Record<string, PropValue> & { key?: string | number }

/** 자식 컴포넌트: props를 받아 VNode를 돌려주는 순수 함수. 훅을 쓸 수 없다. */
export type Component<P> = (props: P & { children: VNode[] }) => VNode

/**
 * VNode를 만드는 함수. JSX `<li class="a">텍스트</li>`가 컴파일되면 `h('li', { class: 'a' }, '텍스트')`가 된다.
 * - onClick 같은 함수 → events.click
 * - key → vnode.key (+ Phase 1과 같이 data-key 속성으로도 남겨서 개발자 도구에서 보인다)
 * - true → 빈 속성(checked=""), false·null·undefined → 속성 없음, 숫자 → 문자열
 * - 첫 인자가 함수면 자식 컴포넌트로 보고 그 자리에서 호출해 결과 VNode를 넣는다.
 */
export function h<P>(type: Component<P>, props: P, ...children: Child[]): VNode
export function h(type: string, props?: Props | null, ...children: Child[]): VElement
export function h(type: string | Component<unknown>, props?: Props | null, ...children: Child[]): VNode {
  const kids = normalizeChildren(children)
  if (typeof type === 'function') return renderChild(type, { ...props, children: kids })

  const vnode: VElement = { type: 'element', tag: type, props: {}, children: kids }
  for (const [name, value] of Object.entries(props ?? {})) {
    if (name === 'key') {
      if (value === undefined || value === null) continue
      vnode.key = String(value)
      vnode.props[KEY_ATTR] = vnode.key
    } else if (typeof value === 'function') {
      // onClick → click. 실제 React도 on 뒤 이름을 DOM 이벤트 이름으로 쓴다.
      vnode.events ??= {}
      vnode.events[name.slice(2).toLowerCase()] = value
    } else if (value === true) vnode.props[name] = ''
    else if (value !== false && value !== null && value !== undefined) vnode.props[name] = String(value)
  }
  return vnode
}

function normalizeChildren(children: Child[], result: VNode[] = []): VNode[] {
  for (const child of children) {
    if (Array.isArray(child)) normalizeChildren(child, result)
    else if (child === null || child === undefined || typeof child === 'boolean') continue
    else result.push(typeof child === 'object' ? child : { type: 'text', text: String(child) })
  }
  return result
}
