import '../style.css'
import { childrenToVNodes, domToVNode } from '../core/dom-to-vnode'
import { diff, type Op } from '../core/diff'
import { patch } from '../core/patch'
import { childrenToHtml, createElement } from '../core/render'
import { sanitize } from '../core/sanitize'
import { findDuplicateKeys, type VElement } from '../core/vnode'
import { History } from './history'
import { flash, showOps, vnodeToTree } from './inspect'

const actual = document.querySelector<HTMLElement>('#actual')!
const editor = document.querySelector<HTMLTextAreaElement>('#editor')!
const patchButton = document.querySelector<HTMLButtonElement>('#patch')!
const backButton = document.querySelector<HTMLButtonElement>('#back')!
const forwardButton = document.querySelector<HTMLButtonElement>('#forward')!
const status = document.querySelector<HTMLElement>('#status')!
const positionLabel = document.querySelector<HTMLElement>('#position')!
const log = document.querySelector<HTMLOListElement>('#log')!
const vdomView = document.querySelector<HTMLElement>('#vdom')!

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
report('샘플을 불러왔어. 테스트 영역을 고친 뒤 Patch를 눌러 봐.', [], [])

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
  const records = observer.takeRecords()
  editor.value = childrenToHtml(next.children)
  updateControls()
  report(ops.length > 0 ? 'Patch했어.' : '바뀐 부분이 없어서 기록하지 않았어.', ops, records, [
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
  const records = observer.takeRecords()
  editor.value = childrenToHtml(to.children)
  updateControls()
  report('기록을 이동했어.', ops, records)
}

function updateControls(): void {
  backButton.disabled = !history.canBack
  forwardButton.disabled = !history.canForward
  const { index, length } = history.position
  positionLabel.textContent = `${index + 1} / ${length}`
}

/** 상태 메시지와 함께 diff 연산 목록, 실제 DOM 변경 횟수, 지금 VDOM을 보여 준다. 바뀐 DOM은 깜빡인다. */
function report(message: string, ops: Op[], records: MutationRecord[], warnings: string[] = []): void {
  status.replaceChildren(document.createTextNode(`${message} 연산 ${ops.length}개, 실제 DOM 변경 ${records.length}건.`))
  for (const warning of warnings) {
    const item = document.createElement('p')
    item.className = 'status__warning'
    item.textContent = `⚠ ${warning}`
    status.appendChild(item)
  }
  showOps(log, ops)
  flash(records)
  vdomView.textContent = vnodeToTree(history.current)
}

// 예제 버튼: 테스트 영역 소스를 대신 고치고 Patch를 누른다. 다시 누르면 원래대로 돌아간다.
const swap = (src: string, a: string, b: string) => (src.includes(a) ? src.replace(a, b) : src.replace(b, a))
/** 목록 안의 줄(<li>)을 한 칸씩 돌린다: 맨 뒤가 맨 앞으로. */
const rotate = (src: string, tag: string) =>
  src.replace(new RegExp(`(<${tag}>\\n)([\\s\\S]*?)(\\n\\s*</${tag}>)`), (_, open: string, body: string, close: string) => {
    const lines = body.split('\n')
    return open + [lines.pop(), ...lines].join('\n') + close
  })
const scenarios: Record<string, (src: string) => string> = {
  text: (src) => swap(src, '>사과<', '>풋사과<'),
  prop: (src) => swap(src, 'class="lead"', 'class="lead mark"'),
  insert: (src) =>
    src.includes('data-key="new"')
      ? src.replace(/\s*<li data-key="new">.*?<\/li>/, '')
      : src.replace('<li data-key="b">', '<li data-key="new">새 항목</li>\n<li data-key="b">'),
  replace: (src) =>
    src.includes('<blockquote>')
      ? src.replace(/<blockquote>(.*?)<\/blockquote>/, '<h4>$1</h4>')
      : src.replace(/<h4>(.*?)<\/h4>/, '<blockquote>$1</blockquote>'),
  move: (src) => rotate(src, 'ul'),
  nokey: (src) => rotate(src, 'ol'),
  reset: () => childrenToHtml(initial.children),
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-scenario]')) {
  button.addEventListener('click', () => {
    const next = scenarios[button.dataset.scenario!](editor.value)
    if (next === editor.value && button.dataset.scenario !== 'reset') {
      status.textContent = '예제가 고칠 부분을 소스에서 못 찾았어. "샘플로 되돌리기"를 누르고 다시 해 봐.'
      return
    }
    editor.value = next
    patchButton.click()
  })
}
