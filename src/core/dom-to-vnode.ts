import { KEY_ATTR, type VElement, type VNode } from './vnode'

/**
 * 실제 DOM 노드를 VNode로 바꾼다.
 * 주석과 "줄바꿈이 섞인 공백만 있는" 텍스트(들여쓰기)는 화면에 의미가 없어 null을 돌려준다.
 * 공백 한 칸(`<b>a</b> <i>b</i>`)은 실제 띄어쓰기라서 남긴다.
 */
export function domToVNode(node: Node): VNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? ''
    if (/^\s*$/.test(text) && text.includes('\n')) return null
    return { type: 'text', text }
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const el = node as Element
  const props: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) props[attr.name] = attr.value

  const vnode: VElement = {
    type: 'element',
    tag: el.tagName.toLowerCase(),
    props,
    children: childrenToVNodes(el.childNodes),
  }
  if (props[KEY_ATTR] !== undefined) vnode.key = props[KEY_ATTR]
  return vnode
}

export function childrenToVNodes(nodes: NodeListOf<ChildNode>): VNode[] {
  const result: VNode[] = []
  for (const child of Array.from(nodes)) {
    const vnode = domToVNode(child)
    if (vnode) result.push(vnode)
  }
  return result
}
