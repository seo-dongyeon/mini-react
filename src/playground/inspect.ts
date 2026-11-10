// 두 실습 페이지가 같이 쓰는 "보여 주기" 도구. 동작(diff·patch)에는 관여하지 않는다.
import type { Op } from '../core/diff'
import type { VNode } from '../core/vnode'

/** 연산 하나를 한 줄 글로 바꾼다. [경로]는 이전 트리에서 자식 번호를 따라 내려간 주소다. */
export function describeOp(op: Op): string {
  const at = (path: number[]) => `[${path.join(',')}]`
  const show = (node: VNode) => (node.type === 'text' ? `"${node.text}"` : `<${node.tag}>`)
  switch (op.type) {
    case 'REPLACE':
      return `REPLACE ${at(op.path)} → ${show(op.node)}`
    case 'REMOVE':
      return `REMOVE ${at(op.path)}`
    case 'INSERT':
      return `INSERT ${at(op.parent)}의 ${op.index}번 자리 ← ${show(op.node)}`
    case 'MOVE':
      return `MOVE ${at(op.path)} → ${at(op.parent)}의 ${op.index}번 자리`
    case 'SET_PROP':
      return `SET_PROP ${at(op.path)} ${op.name}="${op.value}"`
    case 'REMOVE_PROP':
      return `REMOVE_PROP ${at(op.path)} ${op.name}`
    case 'TEXT':
      return `TEXT ${at(op.path)} → "${op.text}"`
  }
}

/** 연산 목록을 <ol>에 채운다. 종류는 data-op에 적어 CSS로 색을 나눈다. */
export function showOps(list: HTMLElement, ops: Op[]): void {
  list.replaceChildren(
    ...ops.map((op) => {
      const item = document.createElement('li')
      item.dataset.op = op.type
      item.textContent = describeOp(op)
      return item
    }),
  )
}

/**
 * 브라우저가 알려 준 DOM 변경 기록의 대상 요소를 잠깐 노랗게 칠한다.
 * class를 붙이면 그것도 DOM 변경이라 VDOM과 어긋나므로, 속성을 건드리지 않는 Web Animations API를 쓴다.
 */
export function flash(records: MutationRecord[]): void {
  const targets = new Set<Element>()
  for (const record of records) {
    const added = Array.from(record.addedNodes).filter((node): node is Element => node instanceof Element)
    if (added.length > 0) added.forEach((el) => targets.add(el))
    else {
      const el = record.target instanceof Element ? record.target : record.target.parentElement
      if (el) targets.add(el)
    }
  }
  for (const el of targets) {
    // jsdom에는 animate가 없다.
    el.animate?.([{ backgroundColor: '#ffe45c' }, { backgroundColor: 'transparent' }], { duration: 900 })
  }
}

/** VNode 트리를 들여쓴 글로 그린다. 앞의 숫자가 부모 안에서의 자식 번호(경로의 한 칸)다. */
export function vnodeToTree(node: VNode, index = 0, depth = 0): string {
  const pad = '  '.repeat(depth) + (depth === 0 ? '' : `${index} `)
  if (node.type === 'text') return `${pad}"${node.text}"`
  const key = node.key === undefined ? '' : ` key=${node.key}`
  const events = node.events ? ` on:${Object.keys(node.events).join(',')}` : ''
  const lines = node.children.map((child, i) => vnodeToTree(child, i, depth + 1))
  return [`${pad}<${node.tag}>${key}${events}`, ...lines].join('\n')
}
