import { childrenToVNodes, domToVNode } from '../src/core/dom-to-vnode'
import type { VElement } from '../src/core/vnode'

export function parseTree(html: string): VElement {
  const container = document.createElement('div')
  container.innerHTML = html
  return domToVNode(container) as VElement
}

export function parseChildren(html: string) {
  const template = document.createElement('template')
  template.innerHTML = html
  return childrenToVNodes(template.content.childNodes)
}
