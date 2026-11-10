import { diff, type Op } from './diff'
import { patch } from './patch'
import { createElement } from './render'
import type { VNode } from './vnode'

type Deps = readonly unknown[] | undefined
type EffectFn = () => void | (() => void)

/** hooks 배열 한 칸. 어떤 훅이 썼는지(kind)를 같이 적어 두어 호출 순서가 바뀌면 바로 알아챈다. */
export type Hook =
  | { kind: 'state'; value: unknown; setState: (next: unknown) => void }
  | { kind: 'effect'; deps: Deps; cleanup?: () => void }
  | { kind: 'memo'; deps: Deps; value: unknown }

/** 컴포넌트 안에서 일어난 일을 바깥(실습 페이지의 패널)에 알려 주는 기록. 동작에는 영향이 없다. */
export type Trace =
  | { type: 'setState'; index: number; prev: unknown; next: unknown; result: 'scheduled' | 'batched' | 'same' }
  | { type: 'render'; count: number }
  | { type: 'memo'; index: number; recomputed: boolean }
  | { type: 'commit'; ops: Op[] }
  | { type: 'effect'; index: number; phase: 'cleanup' | 'run' }

/** 이벤트 위임으로 받는 이벤트. focus·blur처럼 버블링하지 않는 이벤트는 받지 못한다. */
const DELEGATED_EVENTS = ['click', 'input', 'change', 'keydown', 'submit']

// 지금 렌더 중인 루트 컴포넌트. 훅은 이 값을 보고 자기 칸(hooks[hookIndex])을 찾는다.
let current: FunctionComponent | null = null
// 자식 컴포넌트를 렌더하는 중이면 0보다 크다. 이때 훅을 부르면 에러를 낸다.
let childDepth = 0

/**
 * 루트 컴포넌트 하나를 맡아 상태(hooks)를 들고, 렌더 → diff → patch → effect를 돌린다.
 * 함수 컴포넌트는 매번 새로 실행되어 지역 변수가 사라지므로, 상태는 이 객체의 hooks 배열에 둔다.
 */
export class FunctionComponent {
  hooks: Hook[] = []
  renderCount = 0
  onTrace?: (trace: Trace) => void

  private hookIndex = 0
  private vnode: VNode | null = null
  private dom: Node | null = null
  private scheduled = false
  private pendingEffects: { index: number; fn: EffectFn }[] = []

  constructor(private readonly fn: () => VNode, private readonly container: HTMLElement) {}

  /** 처음 그리기: 함수 실행 → VNode → 실제 DOM 생성 → 컨테이너에 붙이기 → effect 실행 */
  mount(): void {
    this.vnode = this.render()
    this.dom = createElement(this.vnode)
    this.container.replaceChildren(this.dom)
    for (const type of DELEGATED_EVENTS) this.container.addEventListener(type, this.dispatch)
    this.commit([])
  }

  /** 다시 그리기: 함수 재실행 → 새 VNode → 이전 VNode와 diff → 바뀐 부분만 patch → effect 실행 */
  update(): void {
    if (!this.vnode || !this.dom) throw new Error('update: mount를 먼저 호출해야 해')
    const next = this.render()
    const ops = diff(this.vnode, next)
    this.dom = patch(this.dom, ops)
    this.vnode = next
    this.commit(ops)
  }

  /**
   * setState가 부른다. 바로 그리지 않고 마이크로태스크로 미뤄서, 같은 이벤트 안의 setState 여러 번을 렌더 1번으로 묶는다(batching).
   * 이벤트 핸들러가 끝나면 브라우저가 마이크로태스크를 실행하므로 화면에는 지연 없이 반영된다.
   */
  schedule(): boolean {
    if (this.scheduled) return false
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      this.update()
    })
    return true
  }

  /** 훅이 부른다. 이번 렌더에서 몇 번째 훅인지 정하고 그 칸을 돌려준다. */
  nextHook<K extends Hook['kind']>(kind: K, create: () => Extract<Hook, { kind: K }>): { index: number; hook: Extract<Hook, { kind: K }> } {
    const index = this.hookIndex++
    if (index >= this.hooks.length) this.hooks.push(create())
    const hook = this.hooks[index]
    if (hook.kind !== kind) {
      throw new Error(`hooks[${index}]는 지난 렌더에 ${hook.kind}였는데 이번엔 ${kind}야. 훅을 if·for 안에서 부르면 순서가 바뀐다`)
    }
    return { index, hook: hook as Extract<Hook, { kind: K }> }
  }

  queueEffect(index: number, fn: EffectFn): void {
    this.pendingEffects.push({ index, fn })
  }

  trace(trace: Trace): void {
    this.onTrace?.(trace)
  }

  private render(): VNode {
    this.hookIndex = 0
    this.pendingEffects = []
    this.renderCount++
    this.trace({ type: 'render', count: this.renderCount })
    current = this
    try {
      const vnode = this.fn()
      if (this.hookIndex !== this.hooks.length) {
        throw new Error(`지난 렌더에는 훅이 ${this.hooks.length}개였는데 이번엔 ${this.hookIndex}개야. 훅은 매번 같은 순서·개수로 불러야 해`)
      }
      return vnode
    } finally {
      current = null
    }
  }

  /** DOM 반영이 끝난 뒤 effect 실행. 다시 실행할 effect는 지난번 cleanup을 먼저 부른다. */
  private commit(ops: Op[]): void {
    this.trace({ type: 'commit', ops })
    const effects = this.pendingEffects
    this.pendingEffects = []
    for (const { index, fn } of effects) {
      const hook = this.hooks[index] as Extract<Hook, { kind: 'effect' }>
      if (hook.cleanup) {
        this.trace({ type: 'effect', index, phase: 'cleanup' })
        hook.cleanup()
      }
      this.trace({ type: 'effect', index, phase: 'run' })
      const cleanup = fn()
      hook.cleanup = typeof cleanup === 'function' ? cleanup : undefined
    }
  }

  /**
   * 이벤트 위임: 컨테이너가 모든 이벤트를 받아, 이벤트가 난 DOM 노드의 위치로 "지금 VDOM"의 노드를 찾아 핸들러를 부른다.
   * 그래서 렌더마다 새로 만들어지는 핸들러를 DOM에 다시 붙이지 않아도 항상 최신 함수(최신 state를 본 클로저)가 불린다.
   * 안쪽 노드부터 바깥으로 올라가며 부르고(버블링), stopPropagation()을 부르면 멈춘다.
   */
  private dispatch = (event: Event): void => {
    const chain: Node[] = [] // 루트 DOM → 이벤트가 난 노드
    for (let node = event.target as Node | null; node && node !== this.container; node = node.parentNode) chain.unshift(node)
    if (chain[0] !== this.dom || !this.vnode) return

    const vnodes: VNode[] = [this.vnode]
    for (let i = 1; i < chain.length; i++) {
      const parent = vnodes[i - 1]
      const index = Array.prototype.indexOf.call(chain[i - 1].childNodes, chain[i])
      const child = parent.type === 'element' ? parent.children[index] : undefined
      if (!child) break
      vnodes.push(child)
    }
    for (let i = vnodes.length - 1; i >= 0; i--) {
      const vnode = vnodes[i]
      const handler = vnode.type === 'element' ? vnode.events?.[event.type] : undefined
      if (!handler) continue
      handler(event)
      if (event.cancelBubble) break
    }
  }
}

/** h(Child, props)가 부른다. 자식이 렌더되는 동안 표시를 켜서, 자식 안의 훅 호출을 막는다. */
export function renderChild<P>(fn: (props: P) => VNode, props: P): VNode {
  childDepth++
  try {
    return fn(props)
  } finally {
    childDepth--
  }
}

function currentRoot(name: string): FunctionComponent {
  if (childDepth > 0) throw new Error(`${name}는 루트 컴포넌트에서만 쓸 수 있어. 자식은 props만 받는 순수 함수로 만들고, 상태는 루트로 올려(Lifting State Up)`)
  if (!current) throw new Error(`${name}는 컴포넌트가 렌더되는 중에만 부를 수 있어`)
  return current
}

function depsChanged(prev: Deps, next: Deps): boolean {
  if (!prev || !next) return true // deps를 안 주면 매 렌더마다 실행
  return prev.length !== next.length || prev.some((value, i) => !Object.is(value, next[i]))
}

/** 값과, 그 값을 바꾸고 다시 렌더를 예약하는 함수를 돌려준다. setState는 렌더가 바뀌어도 같은 함수다. */
export function useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
  const component = currentRoot('useState')
  const { index, hook } = component.nextHook('state', () => {
    const created = {
      kind: 'state' as const,
      value: (typeof initial === 'function' ? (initial as () => T)() : initial) as unknown,
      setState: (next: unknown) => {
        const prev = created.value
        const value = typeof next === 'function' ? (next as (p: unknown) => unknown)(prev) : next
        // 같은 값이면 다시 그릴 필요가 없다.
        if (Object.is(prev, value)) return component.trace({ type: 'setState', index, prev, next: value, result: 'same' })
        created.value = value
        const result = component.schedule() ? 'scheduled' : 'batched'
        component.trace({ type: 'setState', index, prev, next: value, result })
      },
    }
    return created
  })
  return [hook.value as T, hook.setState]
}

/** 렌더가 DOM에 반영된 뒤 fn을 실행한다. deps가 지난번과 같으면 건너뛴다. fn이 돌려준 함수는 다음 실행 전에 부른다(cleanup). */
export function useEffect(fn: EffectFn, deps?: readonly unknown[]): void {
  const component = currentRoot('useEffect')
  let created = false
  const { index, hook } = component.nextHook('effect', () => {
    created = true
    return { kind: 'effect', deps }
  })
  if (created || depsChanged(hook.deps, deps)) {
    hook.deps = deps
    component.queueEffect(index, fn)
  }
}

/** deps가 바뀌었을 때만 fn을 다시 계산하고, 아니면 지난 값을 그대로 돌려준다. */
export function useMemo<T>(fn: () => T, deps: readonly unknown[]): T {
  const component = currentRoot('useMemo')
  let created = false
  const { index, hook } = component.nextHook('memo', () => {
    created = true
    return { kind: 'memo', deps, value: fn() }
  })
  const recomputed = created || depsChanged(hook.deps, deps)
  if (!created && recomputed) {
    hook.deps = deps
    hook.value = fn()
  }
  component.trace({ type: 'memo', index, recomputed })
  return hook.value as T
}
