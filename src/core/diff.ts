import type { VElement, VNode } from './vnode'

/** 루트에서 대상 노드까지 내려가는 자식 인덱스 목록. [] 는 루트 자신. */
export type Path = number[]

/**
 * diff가 만드는 변경 연산.
 * path·parent는 모두 "이전 트리" 기준 주소이고, INSERT·MOVE의 index는 "새 트리"에서의 최종 위치다.
 */
export type Op =
  | { type: 'REPLACE'; path: Path; node: VNode }
  | { type: 'REMOVE'; path: Path }
  | { type: 'INSERT'; parent: Path; index: number; node: VNode }
  | { type: 'MOVE'; path: Path; parent: Path; index: number }
  | { type: 'SET_PROP'; path: Path; name: string; value: string }
  | { type: 'REMOVE_PROP'; path: Path; name: string }
  | { type: 'TEXT'; path: Path; text: string }

/** 두 VNode 트리를 비교해 이전 트리를 새 트리로 바꾸는 연산 목록을 만든다. DOM은 건드리지 않는 순수 함수다. */
export function diff(oldNode: VNode, newNode: VNode): Op[] {
  const ops: Op[] = []
  diffNode(oldNode, newNode, [], ops)
  return ops
}

function diffNode(oldNode: VNode, newNode: VNode, path: Path, ops: Op[]): void {
  // 케이스 3: 종류나 태그가 다르면 안쪽은 비교하지 않고 통째로 교체한다.
  if (oldNode.type !== newNode.type || (isElement(oldNode) && isElement(newNode) && oldNode.tag !== newNode.tag)) {
    ops.push({ type: 'REPLACE', path, node: newNode })
    return
  }
  // 케이스 5: 텍스트 변경
  if (oldNode.type === 'text' && newNode.type === 'text') {
    if (oldNode.text !== newNode.text) ops.push({ type: 'TEXT', path, text: newNode.text })
    return
  }
  const oldEl = oldNode as VElement
  const newEl = newNode as VElement
  diffProps(oldEl, newEl, path, ops)
  if (canUseKeys(oldEl.children) && canUseKeys(newEl.children)) {
    diffKeyedChildren(oldEl.children as KeyedElement[], newEl.children as KeyedElement[], path, ops)
  } else {
    diffIndexedChildren(oldEl.children, newEl.children, path, ops)
  }
}

// 케이스 4: 속성 변경
function diffProps(oldEl: VElement, newEl: VElement, path: Path, ops: Op[]): void {
  for (const [name, value] of Object.entries(newEl.props)) {
    if (oldEl.props[name] !== value) ops.push({ type: 'SET_PROP', path, name, value })
  }
  for (const name of Object.keys(oldEl.props)) {
    if (!(name in newEl.props)) ops.push({ type: 'REMOVE_PROP', path, name })
  }
}

/** key가 없으면 같은 위치끼리 비교한다. 남는 새 자식은 추가(케이스 1), 남는 이전 자식은 삭제(케이스 2). */
function diffIndexedChildren(oldChildren: VNode[], newChildren: VNode[], parent: Path, ops: Op[]): void {
  const common = Math.min(oldChildren.length, newChildren.length)
  for (let i = 0; i < common; i++) diffNode(oldChildren[i], newChildren[i], [...parent, i], ops)
  for (let i = common; i < newChildren.length; i++) {
    ops.push({ type: 'INSERT', parent, index: i, node: newChildren[i] })
  }
  for (let i = common; i < oldChildren.length; i++) ops.push({ type: 'REMOVE', path: [...parent, i] })
}

type KeyedElement = VElement & { key: string }

/** 자식이 하나 이상이고, 전부 key가 있는 요소이며, key가 겹치지 않을 때만 key로 짝을 찾는다. */
function canUseKeys(children: VNode[]): children is KeyedElement[] {
  if (children.length === 0) return false
  const keys = new Set<string>()
  for (const child of children) {
    if (child.type !== 'element' || child.key === undefined || keys.has(child.key)) return false
    keys.add(child.key)
  }
  return true
}

/**
 * key로 이전 자식과 새 자식의 짝을 찾는다.
 * - 짝이 없는 이전 자식은 삭제, 짝이 없는 새 자식은 추가
 * - 짝이 있으면 안쪽을 재귀로 비교하고, 순서가 어긋난 것만 이동시킨다.
 *   "제자리에 둬도 되는 노드"는 이전 인덱스의 최장 증가 부분 수열(LIS)로 골라서 이동 횟수를 최소로 만든다.
 */
function diffKeyedChildren(oldChildren: KeyedElement[], newChildren: KeyedElement[], parent: Path, ops: Op[]): void {
  const oldIndexByKey = new Map(oldChildren.map((child, i) => [child.key, i]))
  const newKeys = new Set(newChildren.map((child) => child.key))

  oldChildren.forEach((child, i) => {
    if (!newKeys.has(child.key)) ops.push({ type: 'REMOVE', path: [...parent, i] })
  })

  // 새 순서대로 나열한 "짝지어진 이전 인덱스" (새 노드는 -1)
  const oldIndexes = newChildren.map((child) => oldIndexByKey.get(child.key) ?? -1)
  const stable = longestIncreasingSubsequence(oldIndexes)

  newChildren.forEach((child, index) => {
    const oldIndex = oldIndexes[index]
    if (oldIndex === -1) {
      ops.push({ type: 'INSERT', parent, index, node: child })
      return
    }
    const oldChild = oldChildren[oldIndex]
    const path = [...parent, oldIndex]
    if (oldChild.tag !== child.tag) {
      // 같은 key인데 태그가 다르면 다른 노드로 본다. REPLACE 후 MOVE하면 교체된 옛 노드를 옮기게 되므로 삭제+추가로 처리한다.
      ops.push({ type: 'REMOVE', path })
      ops.push({ type: 'INSERT', parent, index, node: child })
      return
    }
    diffNode(oldChild, child, path, ops)
    if (!stable.has(index)) ops.push({ type: 'MOVE', path, parent, index })
  })
}

/** 값이 -1이 아닌 원소들 중 최장 증가 부분 수열을 이루는 "위치" 집합을 돌려준다. O(n log n). */
export function longestIncreasingSubsequence(values: number[]): Set<number> {
  const tails: number[] = [] // tails[len] = 길이 len+1 수열의 마지막 원소 위치
  const prev = new Array<number>(values.length).fill(-1)
  values.forEach((value, i) => {
    if (value === -1) return
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (values[tails[mid]] < value) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) prev[i] = tails[lo - 1]
    tails[lo] = i
  })
  const result = new Set<number>()
  for (let i = tails.length ? tails[tails.length - 1] : -1; i !== -1; i = prev[i]) result.add(i)
  return result
}

function isElement(node: VNode): node is VElement {
  return node.type === 'element'
}
