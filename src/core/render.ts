import type { VElement, VNode } from './vnode'

/** VNode → 실제 DOM 노드. 처음 그릴 때와 patch에서 새 노드를 만들 때 쓴다. */
export function createElement(vnode: VNode): Node {
  if (vnode.type === 'text') return document.createTextNode(vnode.text)
  const el = document.createElement(vnode.tag)
  for (const [name, value] of Object.entries(vnode.props)) setProp(el, name, value)
  for (const child of vnode.children) el.appendChild(createElement(child))
  return el
}

/**
 * 속성을 설정한다. input의 value·checked는 사용자가 한 번 건드리면 속성과 화면 값이 따로 놀기 때문에
 * 화면 값(프로퍼티)도 같이 맞춘다.
 */
export function setProp(el: Element, name: string, value: string): void {
  el.setAttribute(name, value)
  if (name === 'value' && 'value' in el) (el as HTMLInputElement).value = value
  if (name === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = true
}

export function removeProp(el: Element, name: string): void {
  el.removeAttribute(name)
  if (name === 'value' && 'value' in el) (el as HTMLInputElement).value = ''
  if (name === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = false
}

// 닫는 태그가 없는 요소
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
])

/**
 * VNode 목록 → 들여쓰기한 HTML 문자열 (테스트 영역 textarea용).
 * 자식이 전부 요소면 줄을 나눠 들여쓰고, 텍스트가 섞여 있으면 한 줄로 그대로 쓴다.
 * 이렇게 하면 들여쓰기로 생긴 공백은 domToVNode가 버리고, 원래 텍스트는 그대로 남아 왕복해도 같은 VNode가 된다.
 */
export function childrenToHtml(children: VNode[], depth = 0): string {
  return children.map((child) => vnodeToHtml(child, depth)).join('\n')
}

export function vnodeToHtml(vnode: VNode, depth = 0): string {
  const indent = '  '.repeat(depth)
  if (vnode.type === 'text') return indent + escapeText(vnode.text)

  const open = `<${vnode.tag}${attrsToHtml(vnode)}>`
  if (VOID_TAGS.has(vnode.tag)) return indent + open
  const close = `</${vnode.tag}>`
  if (vnode.children.length === 0) return indent + open + close

  const blockLayout = vnode.children.every((child) => child.type === 'element')
  if (blockLayout) {
    return `${indent}${open}\n${childrenToHtml(vnode.children, depth + 1)}\n${indent}${close}`
  }
  const inline = vnode.children.map((child) => vnodeToHtml(child, 0)).join('')
  return indent + open + inline + close
}

function attrsToHtml(vnode: VElement): string {
  return Object.entries(vnode.props)
    .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
    .join('')
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}
