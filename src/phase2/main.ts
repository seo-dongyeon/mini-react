// Phase 2 실습 페이지: App을 mount하고, 컴포넌트가 알려 주는 기록(Trace)을 오른쪽 패널에 그린다.
// 패널은 mini-react가 아니라 DOM API로 직접 그린다. 관찰 대상과 관찰 도구가 섞이지 않게 하려는 것이다.
import '../style.css'
import { FunctionComponent, type Hook, type Trace } from '../core/component'
import { flash, showOps } from '../playground/inspect'
import { App } from './app'

const container = document.querySelector<HTMLElement>('#app')!
const hooksBody = document.querySelector<HTMLElement>('#hooks')!
const timeline = document.querySelector<HTMLElement>('#timeline')!
const opsList = document.querySelector<HTMLElement>('#ops')!
const renderCount = document.querySelector<HTMLElement>('#render-count')!

// 실제 DOM이 몇 번 바뀌었는지 브라우저 API로 센다.
const observer = new MutationObserver(() => {})
observer.observe(container, { subtree: true, childList: true, attributes: true, characterData: true })

const component = new FunctionComponent(App, container)
component.onTrace = (trace) => {
  if (trace.type === 'commit') {
    const records = observer.takeRecords()
    const mounting = component.renderCount === 1
    log('commit', mounting ? 'mount → DOM을 처음 만들어 붙임' : `diff → 연산 ${trace.ops.length}개 · patch → 실제 DOM 변경 ${records.length}건`)
    showOps(opsList, trace.ops)
    if (!mounting) flash(records)
    showHooks(component.hooks)
    renderCount.textContent = String(component.renderCount)
  } else log(trace.type, describe(trace))
}
component.mount()

document.querySelector('#clear')!.addEventListener('click', () => timeline.replaceChildren())

function describe(trace: Exclude<Trace, { type: 'commit' }>): string {
  switch (trace.type) {
    case 'setState': {
      const result = { scheduled: '렌더 예약', batched: '이미 예약돼 있어 묶음(batching)', same: '같은 값이라 무시' }[trace.result]
      return `setState hooks[${trace.index}]: ${show(trace.prev)} → ${show(trace.next)} · ${result}`
    }
    case 'render':
      return `render #${trace.count} · App() 실행, 훅 번호 0부터 다시`
    case 'memo':
      return `useMemo hooks[${trace.index}] · ${trace.recomputed ? '다시 계산' : '지난 값 재사용'}`
    case 'effect':
      return `useEffect hooks[${trace.index}] · ${trace.phase === 'run' ? '실행' : 'cleanup'}`
  }
}

function log(kind: string, text: string): void {
  const item = document.createElement('li')
  item.dataset.kind = kind
  item.textContent = text
  timeline.appendChild(item)
  while (timeline.childElementCount > 200) timeline.firstElementChild!.remove()
  timeline.scrollTop = timeline.scrollHeight
}

/** hooks 배열을 표로 그린다. 한 줄이 한 칸이다. */
function showHooks(hooks: Hook[]): void {
  hooksBody.replaceChildren(
    ...hooks.map((hook, index) => {
      const row = document.createElement('tr')
      const value = hook.kind === 'state' ? show(hook.value)
        : hook.kind === 'memo' ? `${show(hook.value)}  deps=${show(hook.deps)}`
        : `deps=${show(hook.deps)}${hook.cleanup ? '  cleanup 있음' : ''}`
      for (const text of [`hooks[${index}]`, hook.kind, value]) {
        const cell = document.createElement('td')
        cell.textContent = text
        row.appendChild(cell)
      }
      return row
    }),
  )
}

function show(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}
