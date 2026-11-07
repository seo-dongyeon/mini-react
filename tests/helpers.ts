import { childrenToVNodes } from '../src/core/dom-to-vnode'
import type { VElement } from '../src/core/vnode'

/** HTML 문자열을 <div> 루트 아래 VNode 트리로 만든다. 플레이그라운드가 테스트 영역을 읽는 방식과 같다. */
export function vroot(html: string): VElement {
  const template = document.createElement('template')
  template.innerHTML = html
  return { type: 'element', tag: 'div', props: {}, children: childrenToVNodes(template.content.childNodes) }
}
