/** 실제 DOM을 흉내 낸 가벼운 객체 트리. 요소 노드와 텍스트 노드 두 종류만 다룬다. */
export type VNode = VElement | VText

export interface VElement {
  type: 'element'
  /** 소문자로 통일한 태그 이름 ('li') */
  tag: string
  /** HTML 속성 그대로. key로 쓰는 data-key도 여기에 남아 렌더링된다. */
  props: Record<string, string>
  children: VNode[]
  /** 형제 사이에서 같은 노드를 찾아 주는 식별자. Phase 1에서는 data-key 속성에서 읽는다. */
  key?: string
}

export interface VText {
  type: 'text'
  text: string
}

export const KEY_ATTR = 'data-key'

/** 트리 전체에서 같은 부모 아래 key가 겹치는 곳을 찾는다. diff는 이런 목록을 인덱스 비교로 처리한다. */
export function findDuplicateKeys(node: VNode): string[] {
  if (node.type === 'text') return []
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const child of node.children) {
    if (child.type !== 'element' || child.key === undefined) continue
    if (seen.has(child.key)) duplicates.push(child.key)
    seen.add(child.key)
  }
  return duplicates.concat(...node.children.map(findDuplicateKeys))
}
