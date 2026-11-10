// Phase 2 실습 앱. 상태와 훅은 전부 루트(App)에 있고, 자식은 props만 받아 그리는 순수 함수다.
import { useEffect, useMemo, useState } from '../core/component'
import { h } from '../core/h'
import type { VNode } from '../core/vnode'

interface Item {
  id: number
  text: string
}

/** 루트 컴포넌트. 주석의 hooks[n]은 오른쪽 "hooks 배열" 패널의 칸 번호와 같다. */
export function App(): VNode {
  const [count, setCount] = useState(0) // hooks[0]
  const [items, setItems] = useState<Item[]>([ // hooks[1]
    { id: 1, text: 'useState' },
    { id: 2, text: 'useEffect' },
    { id: 3, text: 'useMemo' },
  ])
  const [draft, setDraft] = useState('') // hooks[2]
  const [query, setQuery] = useState('') // hooks[3]

  // hooks[4]: items나 query가 바뀔 때만 다시 거른다. count만 바뀐 렌더에서는 지난 결과를 쓴다.
  const visible = useMemo(() => items.filter((item) => item.text.includes(query)), [items, query])

  // hooks[5]: 렌더 결과 바깥(문서 제목)을 바꾸는 일은 effect에서 한다. count가 바뀐 렌더 뒤에만 실행된다.
  useEffect(() => {
    document.title = `count ${count} · mini-react`
  }, [count])

  // hooks[6]: ↑ 키로 +1. 핸들러가 count를 기억(클로저)하므로 count가 바뀌면 옛 핸들러를 떼고(cleanup) 새로 붙인다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' && event.target === document.body) setCount(count + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count])

  const addItem = () => {
    if (!draft.trim()) return
    // setState 2번이지만 렌더는 1번(batching)
    setItems([...items, { id: Math.max(0, ...items.map((item) => item.id)) + 1, text: draft.trim() }])
    setDraft('')
  }

  return h('div', { class: 'app' },
    h(Counter, {
      count,
      onInc: () => setCount(count + 1),
      // 값으로 3번: 셋 다 같은 count를 보고 count+1을 넣으므로 결국 +1
      onIncValue3: () => { setCount(count + 1); setCount(count + 1); setCount(count + 1) },
      // 함수로 3번: 앞 setState의 결과를 이어받으므로 +3. 렌더는 둘 다 1번.
      onIncUpdater3: () => { setCount((c) => c + 1); setCount((c) => c + 1); setCount((c) => c + 1) },
      onSame: () => setCount(count),
    }),
    h(ItemBoard, {
      visible,
      total: items.length,
      draft,
      query,
      onDraft: setDraft,
      onQuery: setQuery,
      onAdd: addItem,
      onRemove: (id: number) => setItems(items.filter((item) => item.id !== id)),
      onRotate: () => setItems([...items.slice(-1), ...items.slice(0, -1)]),
    }),
  )
}

function Counter(props: { count: number; onInc: () => void; onIncValue3: () => void; onIncUpdater3: () => void; onSame: () => void }): VNode {
  return h('section', { class: 'card' },
    h('h3', null, 'useState · batching'),
    h('p', { class: 'count' }, 'count = ', h('strong', null, props.count)),
    h('div', { class: 'toolbar' },
      h('button', { class: 'chip chip--primary', id: 'inc', onClick: props.onInc }, '+1'),
      h('button', { class: 'chip', id: 'inc-value3', onClick: props.onIncValue3 }, 'setCount(count + 1) × 3'),
      h('button', { class: 'chip', id: 'inc-updater3', onClick: props.onIncUpdater3 }, 'setCount(c => c + 1) × 3'),
      h('button', { class: 'chip', id: 'same', onClick: props.onSame }, '같은 값으로 setState'),
    ),
    h('p', { class: 'hint' }, '페이지 빈 곳을 누른 뒤 ↑ 키를 눌러도 +1 (useEffect로 붙인 리스너)'),
  )
}

function ItemBoard(props: {
  visible: Item[]
  total: number
  draft: string
  query: string
  onDraft: (value: string) => void
  onQuery: (value: string) => void
  onAdd: () => void
  onRemove: (id: number) => void
  onRotate: () => void
}): VNode {
  const valueOf = (event: Event) => (event.target as HTMLInputElement).value
  return h('section', { class: 'card' },
    h('h3', null, 'key 목록 · useMemo · 입력'),
    // form의 submit은 기본 동작이 "서버로 보내고 페이지 새로고침"이라 preventDefault로 막는다.
    h('form', { class: 'toolbar', onSubmit: (event) => { event.preventDefault(); props.onAdd() } },
      h('input', { id: 'draft', type: 'text', placeholder: '새 항목', 'aria-label': '새 항목', value: props.draft, onInput: (event) => props.onDraft(valueOf(event)) }),
      h('button', { class: 'chip chip--primary', id: 'add', type: 'submit' }, '추가'),
      h('button', { class: 'chip', id: 'rotate', type: 'button', onClick: props.onRotate }, '맨 뒤를 맨 앞으로'),
    ),
    h('input', { id: 'query', type: 'search', placeholder: '거르기 (useMemo)', 'aria-label': '거르기', value: props.query, onInput: (event) => props.onQuery(valueOf(event)) }),
    h('ul', { class: 'items' },
      props.visible.map((item) => h(ItemRow, { key: item.id, item, onRemove: props.onRemove }))),
    h('p', { class: 'hint' }, `${props.total}개 중 ${props.visible.length}개 표시`),
  )
}

function ItemRow({ item, onRemove }: { key: number; item: Item; onRemove: (id: number) => void }): VNode {
  return h('li', { key: item.id },
    h('span', null, item.text),
    h('button', { class: 'chip', 'aria-label': `${item.text} 삭제`, onClick: () => onRemove(item.id) }, '삭제'),
  )
}
