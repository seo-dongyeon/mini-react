import { describe, expect, it, vi } from 'vitest'
import { FunctionComponent, useEffect, useMemo, useState, type Trace } from '../src/core/component'
import { h } from '../src/core/h'
import type { VNode } from '../src/core/vnode'

const flush = () => Promise.resolve() // 예약된 마이크로태스크(렌더)가 끝나기를 기다린다.

function mount(fn: () => VNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const component = new FunctionComponent(fn, container)
  const traces: Trace[] = []
  component.onTrace = (trace) => traces.push(trace)
  component.mount()
  return { container, component, traces }
}

describe('h', () => {
  it('문자열 props·key·이벤트·자식을 VNode로 나눈다', () => {
    const onClick = () => {}
    expect(h('li', { key: 1, class: 'a', checked: true, hidden: false, onClick }, '값 ', 3, null, [h('b', null, 'x')])).toEqual({
      type: 'element', tag: 'li', key: '1',
      props: { 'data-key': '1', class: 'a', checked: '' },
      events: { click: onClick },
      children: [{ type: 'text', text: '값 ' }, { type: 'text', text: '3' }, { type: 'element', tag: 'b', props: {}, children: [{ type: 'text', text: 'x' }] }],
    })
  })

  it('자식 컴포넌트는 props와 children을 받아 VNode를 돌려준다', () => {
    const Badge = ({ label, children }: { label: string; children: VNode[] }) => h('span', { title: label }, ...children)
    expect(h(Badge, { label: 't' }, '안')).toEqual(h('span', { title: 't' }, '안'))
  })
})

describe('FunctionComponent + useState', () => {
  function Counter() {
    const [count, setCount] = useState(0)
    return h('div', null, h('p', null, `count ${count}`), h('button', { onClick: () => setCount((c) => c + 1) }, '+1'))
  }

  it('mount는 hooks에 상태를 만들고 DOM을 그린다', () => {
    const { container, component } = mount(Counter)
    expect(container.innerHTML).toBe('<div><p>count 0</p><button>+1</button></div>')
    expect(component.hooks).toMatchObject([{ kind: 'state', value: 0 }])
  })

  it('클릭 → setState → 다시 렌더 → 바뀐 텍스트만 patch한다', async () => {
    const { container, traces } = mount(Counter)
    const p = container.querySelector('p')!
    const text = p.firstChild
    container.querySelector('button')!.click()
    await flush()
    expect(p.textContent).toBe('count 1')
    expect(container.querySelector('p')).toBe(p)
    expect(p.firstChild).toBe(text)
    expect(traces.at(-1)).toEqual({ type: 'commit', ops: [{ type: 'TEXT', path: [0, 0], text: 'count 1' }] })
  })

  it('한 이벤트 안의 setState 여러 번은 렌더 1번으로 묶는다', async () => {
    let set!: (n: (c: number) => number) => void
    const { container, component, traces } = mount(() => {
      const [count, setCount] = useState(0)
      set = setCount
      return h('p', null, String(count))
    })
    set((c) => c + 1)
    set((c) => c + 1)
    set((c) => c + 1)
    expect(component.renderCount).toBe(1) // 아직 안 그림
    await flush()
    expect(component.renderCount).toBe(2)
    expect(container.textContent).toBe('3')
    expect(traces.filter((t) => t.type === 'setState').map((t) => t.type === 'setState' && t.result)).toEqual(['scheduled', 'batched', 'batched'])
  })

  it('같은 값으로 setState하면 다시 그리지 않고, setState 함수는 렌더가 바뀌어도 같다', async () => {
    const setters: unknown[] = []
    let set!: (v: string) => void
    const { component } = mount(() => {
      const [value, setValue] = useState('a')
      setters.push(setValue)
      set = setValue
      return h('p', null, value)
    })
    set('a')
    await flush()
    expect(component.renderCount).toBe(1)
    set('b')
    await flush()
    expect(setters[0]).toBe(setters[1])
  })

  it('이벤트는 항상 최신 렌더의 핸들러가 받는다(옛 state를 보지 않는다)', async () => {
    const seen: number[] = []
    const { container } = mount(() => {
      const [count, setCount] = useState(0)
      return h('button', { onClick: () => { seen.push(count); setCount(count + 1) } }, String(count))
    })
    const button = container.querySelector('button')!
    for (let i = 0; i < 3; i++) {
      button.click()
      await flush()
    }
    expect(seen).toEqual([0, 1, 2])
    expect(container.querySelector('button')).toBe(button)
  })

  it('이벤트는 안쪽에서 바깥으로 버블링하고 stopPropagation에서 멈춘다', () => {
    const order: string[] = []
    const { container } = mount(() =>
      h('div', { onClick: () => order.push('div') },
        h('button', { id: 'a', onClick: () => order.push('a') }, 'a'),
        h('button', { id: 'b', onClick: (e) => { order.push('b'); e.stopPropagation() } }, 'b')),
    )
    container.querySelector<HTMLButtonElement>('#a')!.click()
    container.querySelector<HTMLButtonElement>('#b')!.click()
    expect(order).toEqual(['a', 'div', 'b'])
  })

  it('key 목록 순서를 바꾸면 노드를 옮기기만 한다', async () => {
    let reverse!: () => void
    const { container } = mount(() => {
      const [items, setItems] = useState(['a', 'b', 'c'])
      reverse = () => setItems([...items].reverse())
      return h('ul', null, items.map((item) => h('li', { key: item }, item)))
    })
    const before = Array.from(container.querySelectorAll('li'))
    reverse()
    await flush()
    const after = Array.from(container.querySelectorAll('li'))
    expect(after.map((li) => li.textContent)).toEqual(['c', 'b', 'a'])
    expect(after).toEqual([before[2], before[1], before[0]])
  })
})

describe('useEffect', () => {
  it('DOM 반영 뒤 실행하고, deps가 바뀔 때만 cleanup → 다시 실행한다', async () => {
    const log: string[] = []
    let set!: (v: number) => void
    let setOther!: (v: string) => void
    mount(() => {
      const [count, setCount] = useState(0)
      const [other, setOtherState] = useState('x')
      set = setCount
      setOther = setOtherState
      useEffect(() => {
        log.push(`run ${count} dom=${document.body.lastElementChild!.textContent}`)
        return () => log.push(`cleanup ${count}`)
      }, [count])
      return h('p', null, `${count}${other}`)
    })
    expect(log).toEqual(['run 0 dom=0x'])
    setOther('y')
    await flush()
    expect(log).toEqual(['run 0 dom=0x']) // deps 그대로 → 건너뜀
    set(1)
    await flush()
    expect(log).toEqual(['run 0 dom=0x', 'cleanup 0', 'run 1 dom=1y'])
  })

  it('deps가 없으면 매 렌더, 빈 배열이면 처음 한 번만 실행한다', async () => {
    let every = 0
    let once = 0
    let set!: (v: number) => void
    mount(() => {
      const [n, setN] = useState(0)
      set = setN
      useEffect(() => { every++ })
      useEffect(() => { once++ }, [])
      return h('p', null, String(n))
    })
    set(1)
    await flush()
    set(2)
    await flush()
    expect([every, once]).toEqual([3, 1])
  })
})

describe('useMemo', () => {
  it('deps가 같으면 지난 값을 돌려주고 계산하지 않는다', async () => {
    const compute = vi.fn((n: number) => n * 2)
    let setN!: (v: number) => void
    let setLabel!: (v: string) => void
    const { container } = mount(() => {
      const [n, setNState] = useState(1)
      const [label, setLabelState] = useState('a')
      setN = setNState
      setLabel = setLabelState
      const doubled = useMemo(() => compute(n), [n])
      return h('p', null, `${label}${doubled}`)
    })
    setLabel('b')
    await flush()
    expect(compute).toHaveBeenCalledTimes(1)
    setN(5)
    await flush()
    expect(compute).toHaveBeenCalledTimes(2)
    expect(container.textContent).toBe('b10')
  })
})

describe('훅 규칙', () => {
  it('자식 컴포넌트에서 훅을 부르면 에러', () => {
    const Child = () => {
      useState(0)
      return h('p', null)
    }
    expect(() => mount(() => h('div', null, h(Child, {})))).toThrow(/루트 컴포넌트에서만/)
  })

  it('렌더 밖에서 훅을 부르면 에러', () => {
    expect(() => useState(0)).toThrow(/렌더되는 중에만/)
  })

  it('훅 순서나 개수가 바뀌면 에러', () => {
    let flag = true
    const container = document.createElement('div')
    const component = new FunctionComponent(() => {
      if (flag) useState(0)
      useMemo(() => 1, [])
      return h('p', null)
    }, container)
    component.mount()
    flag = false
    expect(() => component.update()).toThrow(/hooks\[0\]는 지난 렌더에 state/)
  })
})
