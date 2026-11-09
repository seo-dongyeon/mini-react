import '../style.css'
import { childrenToVNodes, domToVNode } from '../core/dom-to-vnode'
import { diff, type Op } from '../core/diff'
import { patch } from '../core/patch'
import { childrenToHtml, createElement } from '../core/render'
import { sanitize } from '../core/sanitize'
import { findDuplicateKeys, type VElement } from '../core/vnode'
import { History } from './history'

const actual = document.querySelector<HTMLElement>('#actual')!
const editor = document.querySelector<HTMLTextAreaElement>('#editor')!
const patchButton = document.querySelector<HTMLButtonElement>('#patch')!
const backButton = document.querySelector<HTMLButtonElement>('#back')!
const forwardButton = document.querySelector<HTMLButtonElement>('#forward')!
const status = document.querySelector<HTMLElement>('#status')!
const positionLabel = document.querySelector<HTMLElement>('#position')!
const log = document.querySelector<HTMLOListElement>('#log')!

// 실제 DOM이 몇 번 바뀌었는지 브라우저 API로 센다. "바뀐 부분만 반영"을 숫자로 확인하는 용도다.
const observer = new MutationObserver(() => {})
observer.observe(actual, { subtree: true, childList: true, attributes: true, characterData: true })

// 1) 로드: 실제 영역의 샘플 HTML → VDOM
sanitize(actual)
const initial = domToVNode(actual) as VElement
// 샘플 HTML의 들여쓰기 공백은 VDOM에서 빠지므로, 실제 DOM을 VDOM과 1:1로 맞춰 둔다. patch의 path가 이 대응에 의존한다.
actual.replaceChildren(...initial.children.map(createElement))
observer.takeRecords()
const history = new History(initial)

// 2) 그 VDOM으로 테스트 영역을 렌더링
editor.value = childrenToHtml(initial.children)
updateControls()
report('샘플을 불러왔어. 테스트 영역을 고친 뒤 Patch를 눌러 봐.', [], 0)

patchButton.addEventListener('click', () => {
  // 3) 테스트 영역 → VDOM. <template> 안에서는 스크립트가 실행되지 않는다.
  const template = document.createElement('template')
  template.innerHTML = editor.value
  const warnings = sanitize(template.content)
  // 루트(실제 영역 컨테이너)는 그대로 두고 자식만 바꾼다.
  const next: VElement = { ...history.current as VElement, children: childrenToVNodes(template.content.childNodes) }

  // 4) diff → 바뀐 부분만 실제 영역에 반영 → 기록
  const ops = diff(history.current, next)
  if (ops.length > 0) {
    patch(actual, ops)
    history.push(next)
  }
  const mutations = observer.takeRecords().length
  editor.value = childrenToHtml(next.children)
  updateControls()
  report(ops.length > 0 ? 'Patch했어.' : '바뀐 부분이 없어서 기록하지 않았어.', ops, mutations, [
    ...warnings,
    ...findDuplicateKeys(next).map((key) => `data-key "${key}"가 겹쳐서 이 목록은 위치끼리 비교했어`),
  ])
})

backButton.addEventListener('click', () => move(() => history.back()))
forwardButton.addEventListener('click', () => move(() => history.forward()))

// 5) 기록 이동: 실제 영역은 diff/patch로 부분 갱신하고, 테스트 영역은 그 시점 VDOM으로 다시 채운다.
function move(step: () => VElement | undefined): void {
  const from = history.current
  const to = step()
  if (!to) return
  const ops = diff(from, to)
  patch(actual, ops)
  const mutations = observer.takeRecords().length
  editor.value = childrenToHtml(to.children)
  updateControls()
  report('기록을 이동했어.', ops, mutations)
}

function updateControls(): void {
  backButton.disabled = !history.canBack
  forwardButton.disabled = !history.canForward
  const { index, length } = history.position
  positionLabel.textContent = `${index + 1} / ${length}`
}

/** 상태 메시지와 함께 diff 연산 목록, 실제 DOM 변경 횟수를 보여 준다. */
function report(message: string, ops: Op[], mutations: number, warnings: string[] = []): void {
  status.replaceChildren(document.createTextNode(`${message} 연산 ${ops.length}개, 실제 DOM 변경 ${mutations}건.`))
  for (const warning of warnings) {
    const item = document.createElement('p')
    item.className = 'status__warning'
    item.textContent = `⚠ ${warning}`
    status.appendChild(item)
  }
  log.replaceChildren(
    ...ops.map((op) => {
      const item = document.createElement('li')
      item.textContent = describeOp(op)
      return item
    }),
  )
}

function describeOp(op: Op): string {
  const at = (path: number[]) => `[${path.join(',')}]`
  const show = (node: { type: 'text'; text: string } | { type: 'element'; tag: string }) =>
    node.type === 'text' ? `"${node.text}"` : `<${node.tag}>`
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
