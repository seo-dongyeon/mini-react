import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import pageHtml from '../index.html?raw'
import { childrenToVNodes, domToVNode } from '../src/core/dom-to-vnode'
import { History } from '../src/playground/history'
import { parseChildren } from './phase1-fixtures'

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector)
  if (!node) throw new Error(`테스트 요소를 찾을 수 없어: ${selector}`)
  return node
}

function applyHtml(html: string): void {
  element<HTMLTextAreaElement>('#editor').value = html
  element<HTMLButtonElement>('#patch').click()
}

function expectAreas(html: string): void {
  const expected = parseChildren(html)
  expect(childrenToVNodes(element('#actual').childNodes)).toEqual(expected)
  expect(parseChildren(element<HTMLTextAreaElement>('#editor').value)).toEqual(expected)
}

describe('Phase 1 State History', () => {
  it('처음과 끝을 넘지 않고 이동하며 과거 상태를 유지한다', () => {
    const initial = { text: '처음' }
    const history = new History(initial)
    expect(history.position).toEqual({ index: 0, length: 1 })
    expect(history.canBack).toBe(false)
    expect(history.canForward).toBe(false)
    expect(history.back()).toBeUndefined()
    expect(history.forward()).toBeUndefined()
    history.push({ text: '두 번째' })
    history.push({ text: '세 번째' })
    expect(history.back()).toEqual({ text: '두 번째' })
    expect(history.back()).toBe(initial)
    expect(history.back()).toBeUndefined()
    expect(history.current).toBe(initial)
    expect(history.forward()).toEqual({ text: '두 번째' })
    expect(history.forward()).toEqual({ text: '세 번째' })
    expect(history.forward()).toBeUndefined()
    expect(initial).toEqual({ text: '처음' })
  })

  it('뒤로 간 후 새 상태를 저장하면 앞쪽 기록을 제거한다', () => {
    const history = new History('A')
    history.push('B')
    history.push('C')
    history.back()
    history.push('D')
    expect(history.position).toEqual({ index: 2, length: 3 })
    expect(history.current).toBe('D')
    expect(history.canForward).toBe(false)
    expect(history.forward()).toBeUndefined()
    expect(history.back()).toBe('B')
    expect(history.forward()).toBe('D')
  })
})

describe('Phase 1 실제 페이지 버튼 통합', () => {
  beforeEach(async () => {
    vi.resetModules()
    const parsed = new DOMParser().parseFromString(pageHtml, 'text/html')
    document.body.innerHTML = parsed.body.innerHTML
    document.querySelectorAll('script').forEach((script) => script.remove())
    await import('../src/playground/main')
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('실제 index.html의 샘플을 VDOM으로 읽어 편집기에 표시하고 기록을 초기화한다', () => {
    const actual = element('#actual')
    expect(actual.querySelectorAll(':scope > article')).toHaveLength(6)
    expect(parseChildren(element<HTMLTextAreaElement>('#editor').value)).toEqual(childrenToVNodes(actual.childNodes))
    expect(element('#position').textContent).toBe('1 / 1')
    expect(element<HTMLButtonElement>('#back').disabled).toBe(true)
    expect(element<HTMLButtonElement>('#forward').disabled).toBe(true)
    expect(element('#status').textContent).toContain('실제 DOM 변경 0건')
  })

  it('편집 중에는 실제 영역이 유지되고 Patch를 누르면 변경과 기록을 반영한다', () => {
    const initial = element('#actual').innerHTML
    element<HTMLTextAreaElement>('#editor').value = '<section><h2>새 제목</h2><p title="설명">내용</p></section>'
    element('#editor').dispatchEvent(new Event('input', { bubbles: true }))
    expect(element('#actual').innerHTML).toBe(initial)
    element<HTMLButtonElement>('#patch').click()
    expectAreas('<section><h2>새 제목</h2><p title="설명">내용</p></section>')
    expect(element('#position').textContent).toBe('2 / 2')
    expect(element<HTMLButtonElement>('#back').disabled).toBe(false)
    expect(element('#log').children.length).toBeGreaterThan(0)
  })

  it('텍스트만 편집하면 페이지에서도 변경하지 않은 DOM 노드를 재사용한다', () => {
    const article = element('[data-key="dentist"]')
    const heading = element('[data-key="dentist"] h3')
    const text = heading.firstChild
    const other = element('[data-key="meeting"]')
    applyHtml(element<HTMLTextAreaElement>('#editor').value.replace('금요일 치과 예약', '토요일 치과 예약'))
    expect(element('[data-key="dentist"]')).toBe(article)
    expect(element('[data-key="dentist"] h3')).toBe(heading)
    expect(heading.firstChild).toBe(text)
    expect(heading.textContent).toBe('토요일 치과 예약')
    expect(element('[data-key="meeting"]')).toBe(other)
    expect(element('#log').children).toHaveLength(1)
    expect(element('#status').textContent).toContain('실제 DOM 변경 1건')
  })

  it('초기 상태의 Patch와 반복 Patch는 기록과 DOM 변경을 추가하지 않는다', () => {
    element<HTMLButtonElement>('#patch').click()
    expect(element('#position').textContent).toBe('1 / 1')
    expect(element('#status').textContent).toContain('실제 DOM 변경 0건')
    applyHtml('<p>새 내용</p>')
    const paragraph = element('#actual p')
    element<HTMLButtonElement>('#patch').click()
    expect(element('#position').textContent).toBe('2 / 2')
    expect(element('#actual p')).toBe(paragraph)
    expect(element('#log').children).toHaveLength(0)
    expect(element('#status').textContent).toContain('실제 DOM 변경 0건')
  })

  it('뒤로가기와 앞으로가기는 두 영역과 버튼 상태를 함께 복원한다', () => {
    const initial = element<HTMLTextAreaElement>('#editor').value
    applyHtml('<p data-key="a">A</p>')
    applyHtml('<section data-key="b">B</section>')
    element<HTMLButtonElement>('#back').click()
    expectAreas('<p data-key="a">A</p>')
    expect(element('#position').textContent).toBe('2 / 3')
    expect(element<HTMLButtonElement>('#forward').disabled).toBe(false)
    element<HTMLButtonElement>('#back').click()
    expectAreas(initial)
    expect(element('#position').textContent).toBe('1 / 3')
    expect(element<HTMLButtonElement>('#back').disabled).toBe(true)
    element<HTMLButtonElement>('#forward').click()
    element<HTMLButtonElement>('#forward').click()
    expectAreas('<section data-key="b">B</section>')
    expect(element('#position').textContent).toBe('3 / 3')
    expect(element<HTMLButtonElement>('#forward').disabled).toBe(true)
  })

  it('뒤로 간 후 새 Patch는 앞으로 갈 기록을 대체한다', () => {
    applyHtml('<p>A</p>')
    applyHtml('<p>B</p>')
    element<HTMLButtonElement>('#back').click()
    applyHtml('<p>C</p>')
    expectAreas('<p>C</p>')
    expect(element('#position').textContent).toBe('3 / 3')
    expect(element<HTMLButtonElement>('#forward').disabled).toBe(true)
    element<HTMLButtonElement>('#back').click()
    expectAreas('<p>A</p>')
    element<HTMLButtonElement>('#forward').click()
    expectAreas('<p>C</p>')
  })

  it('과거 상태에서 변경 없는 Patch는 앞으로 갈 기록을 보존한다', () => {
    applyHtml('<p>A</p>')
    applyHtml('<p>B</p>')
    element<HTMLButtonElement>('#back').click()
    element<HTMLButtonElement>('#patch').click()
    expect(element('#position').textContent).toBe('2 / 3')
    expect(element<HTMLButtonElement>('#forward').disabled).toBe(false)
    element<HTMLButtonElement>('#forward').click()
    expectAreas('<p>B</p>')
  })

  it('기록 이동도 기존 DOM 노드와 이벤트를 유지하며 부분 갱신한다', () => {
    applyHtml('<p data-key="a">A</p><button data-key="b">클릭</button>')
    const paragraph = element('#actual p')
    const text = paragraph.firstChild
    const button = element<HTMLButtonElement>('#actual button')
    let clicks = 0
    button.addEventListener('click', () => clicks++)
    applyHtml('<p data-key="a">B</p><button data-key="b">클릭</button>')
    element<HTMLButtonElement>('#back').click()
    expect(paragraph.textContent).toBe('A')
    expect(element('#actual p')).toBe(paragraph)
    expect(paragraph.firstChild).toBe(text)
    expect(element('#actual button')).toBe(button)
    element<HTMLButtonElement>('#forward').click()
    expect(paragraph.textContent).toBe('B')
    expect(element('#actual p')).toBe(paragraph)
    expect(paragraph.firstChild).toBe(text)
    expect(element('#actual button')).toBe(button)
    button.click()
    expect(clicks).toBe(1)
    expect(element('#status').textContent).toContain('실제 DOM 변경 1건')
  })

  it('빈 영역으로 Patch한 뒤 앞뒤 이동으로 복원한다', () => {
    const initial = element<HTMLTextAreaElement>('#editor').value
    applyHtml('')
    expectAreas('')
    element<HTMLButtonElement>('#back').click()
    expectAreas(initial)
    element<HTMLButtonElement>('#forward').click()
    expectAreas('')
  })

  it('위험 HTML을 정화한 결과를 두 영역과 기록에 반영하고 경고한다', () => {
    applyHtml('<p onclick="alert(1)">안전한 내용</p><script>alert(1)</script>')
    expectAreas('<p>안전한 내용</p>')
    expect(element('#status').textContent).toContain('태그를 제거')
    expect(element('#status').textContent).toContain('이벤트 핸들러')
    element<HTMLButtonElement>('#back').click()
    element<HTMLButtonElement>('#forward').click()
    expectAreas('<p>안전한 내용</p>')
  })

  it('중복 key를 경고하면서 Patch와 기록 이동을 완료한다', () => {
    const html = '<p data-key="a">하나</p><p data-key="a">둘</p>'
    applyHtml(html)
    expectAreas(html)
    expect(element('#status').textContent).toContain('data-key "a"가 겹쳐서')
    element<HTMLButtonElement>('#back').click()
    element<HTMLButtonElement>('#forward').click()
    expectAreas(html)
  })

  it('최상위 텍스트가 섞인 HTML도 반복 Patch 시 동일 상태로 유지된다', () => {
    applyHtml('앞 <b>강조</b> 뒤')
    const first = domToVNode(element('#actual'))
    expect(element('#actual').textContent).toBe('앞 강조 뒤')
    element<HTMLButtonElement>('#patch').click()
    expect(domToVNode(element('#actual'))).toEqual(first)
    expect(element('#position').textContent).toBe('2 / 2')
  })
})
