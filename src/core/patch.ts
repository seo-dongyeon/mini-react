import type { Op, Path } from './diff'
import { createElement, removeProp, setProp } from './render'

/**
 * diff가 만든 연산 목록을 실제 DOM에 적용한다. 루트가 교체되면 새 루트를 돌려준다.
 *
 * 1) 찾기: DOM을 건드리기 전에 모든 path를 실제 노드로 바꿔 둔다.
 *    path는 이전 트리 기준이라, 먼저 하나를 지우면 뒤 연산의 인덱스가 틀어지기 때문이다.
 * 2) 적용: 속성·텍스트·교체 → 삭제 → 부모별 추가·이동 순서로, 찾아 둔 노드 참조를 직접 쓴다.
 */
export function patch(root: Node, ops: Op[]): Node {
  const resolved = ops.map((op) => ({
    op,
    target: 'path' in op ? resolvePath(root, op.path) : null,
    parent: 'parent' in op ? resolvePath(root, op.parent) : null,
  }))

  let newRoot = root
  for (const { op, target } of resolved) {
    if (op.type === 'SET_PROP') setProp(target as Element, op.name, op.value)
    else if (op.type === 'REMOVE_PROP') removeProp(target as Element, op.name)
    else if (op.type === 'TEXT') (target as Text).nodeValue = op.text
    else if (op.type === 'REPLACE') {
      const node = createElement(op.node)
      if (target === root) newRoot = node
      ;(target as ChildNode).replaceWith(node)
    }
  }

  for (const { op, target } of resolved) {
    if (op.type === 'REMOVE') (target as ChildNode).remove()
  }

  // 부모별로 "index번 자리에 이 노드" 목록을 모은다.
  const placements = new Map<Node, Map<number, Node>>()
  for (const { op, target, parent } of resolved) {
    if (op.type !== 'INSERT' && op.type !== 'MOVE') continue
    const node = op.type === 'INSERT' ? createElement(op.node) : (target as Node)
    if (!placements.has(parent!)) placements.set(parent!, new Map())
    placements.get(parent!)!.set(op.index, node)
  }
  for (const [parent, byIndex] of placements) placeChildren(parent, byIndex)

  return newRoot
}

/**
 * 부모의 최종 자식 순서를 만들고 뒤에서부터 맞춘다.
 * 연산에 없는 자식(제자리 노드)은 지금 순서 그대로 빈자리를 채운다.
 * 옮기거나 새로 넣을 노드만 "바로 다음에 와야 할 노드" 앞에 넣는다.
 * 제자리 노드는 이미 서로의 순서가 맞으므로 건드리지 않는다. 옮기면 포커스 같은 상태를 잃는다.
 */
function placeChildren(parent: Node, byIndex: Map<number, Node>): void {
  const moving = new Set(byIndex.values())
  const staying = Array.from(parent.childNodes).filter((node) => !moving.has(node))
  const total = staying.length + byIndex.size
  const finalOrder: Node[] = []
  for (let i = 0, s = 0; i < total; i++) finalOrder.push(byIndex.get(i) ?? staying[s++])

  let anchor: Node | null = null
  for (let i = finalOrder.length - 1; i >= 0; i--) {
    const node = finalOrder[i]
    if (moving.has(node) && (node.parentNode !== parent || node.nextSibling !== anchor)) parent.insertBefore(node, anchor)
    anchor = node
  }
}

function resolvePath(root: Node, path: Path): Node {
  let node = root
  for (const index of path) {
    const next = node.childNodes[index]
    // 실제 DOM과 VNode가 어긋났다는 뜻. 엉뚱한 노드를 고치지 않도록 바로 멈춘다.
    if (!next) throw new Error(`patch: 경로 [${path.join(', ')}]에 해당하는 노드가 없어`)
    node = next
  }
  return node
}
