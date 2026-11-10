// 기능 테스트: phase2.html을 그대로 띄우고 버튼·입력으로 Phase 2 요구사항 흐름을 확인한다.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import html from '../phase2.html?raw'

const flush = () => Promise.resolve()
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const count = () => $('.count strong').textContent
const renders = () => Number($('#render-count').textContent)
const items = () => Array.from(document.querySelectorAll('.items li span'), (span) => span.textContent)
const timeline = () => Array.from(document.querySelectorAll('#timeline li'), (li) => li.textContent ?? '')
const ops = () => Array.from(document.querySelectorAll('#ops li'), (li) => li.textContent!.split(' ')[0])
const hookValue = (index: number) => document.querySelectorAll('#hooks tr')[index].lastElementChild!.textContent

async function click(selector: string): Promise<void> {
  $(selector).click()
  await flush()
}

async function type(selector: string, value: string): Promise<void> {
  const input = $<HTMLInputElement>(selector)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flush()
}

beforeEach(async () => {
  vi.resetModules()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  document.body.replaceChildren(...Array.from(doc.body.childNodes))
  await import('../src/phase2/main')
})

describe('mount', () => {
  it('App을 그리고 hooks 배열 7칸과 effect 실행을 보여 준다', () => {
    expect(count()).toBe('0')
    expect(items()).toEqual(['useState', 'useEffect', 'useMemo'])
    expect(document.querySelectorAll('#hooks tr')).toHaveLength(7)
    expect(hookValue(0)).toBe('0')
    expect(renders()).toBe(1)
    expect(timeline().filter((line) => line.includes('useEffect'))).toHaveLength(2)
    expect(document.title).toBe('count 0 · mini-react')
  })
})

describe('useState', () => {
  it('+1: 글자 하나만 patch하고 count에 걸린 effect만 다시 실행한다', async () => {
    const strong = $('.count strong')
    $('#clear').click()
    await click('#inc')
    expect(count()).toBe('1')
    expect($('.count strong')).toBe(strong)
    expect(ops()).toEqual(['TEXT'])
    expect(hookValue(0)).toBe('1')
    expect(document.title).toBe('count 1 · mini-react')
    expect(timeline().map((line) => line.split(' ')[0])).toEqual([
      'setState', 'render', 'useMemo', 'diff', 'useEffect', 'useEffect', 'useEffect',
    ])
    expect(timeline()[2]).toContain('지난 값 재사용')
    expect(timeline()[5]).toContain('cleanup')
  })

  it('값으로 3번은 +1, 함수로 3번은 +3이고 둘 다 렌더는 1번이다', async () => {
    await click('#inc-value3')
    expect(count()).toBe('1')
    expect(renders()).toBe(2)
    await click('#inc-updater3')
    expect(count()).toBe('4')
    expect(renders()).toBe(3)
    expect(timeline().filter((line) => line.includes('batching'))).toHaveLength(2)
  })

  it('같은 값으로 setState하면 렌더하지 않는다', async () => {
    await click('#same')
    expect(renders()).toBe(1)
    expect(timeline().at(-1)).toContain('같은 값이라 무시')
  })

  it('useEffect로 붙인 키 리스너는 최신 count를 본다', async () => {
    for (let i = 0; i < 3; i++) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
      await flush()
    }
    expect(count()).toBe('3')
  })
})

describe('목록', () => {
  it('입력 → 추가: 입력칸은 그대로 두고 항목 하나만 넣는다', async () => {
    const draft = $<HTMLInputElement>('#draft')
    await type('#draft', '새 항목')
    expect(hookValue(2)).toBe('"새 항목"')
    const before = renders()
    await click('#add')
    expect(items()).toEqual(['useState', 'useEffect', 'useMemo', '새 항목'])
    expect($('#draft')).toBe(draft)
    expect(draft.value).toBe('')
    expect(renders()).toBe(before + 1) // setItems + setDraft → 렌더 1번
    expect(ops()).toContain('INSERT')
  })

  it('맨 뒤를 맨 앞으로: 노드를 새로 만들지 않고 하나만 옮긴다', async () => {
    const before = Array.from(document.querySelectorAll('.items li'))
    await click('#rotate')
    expect(items()).toEqual(['useMemo', 'useState', 'useEffect'])
    expect(Array.from(document.querySelectorAll('.items li'))).toEqual([before[2], before[0], before[1]])
    expect(ops()).toEqual(['MOVE'])
  })

  it('삭제 버튼은 자식 → 부모 콜백으로 루트 state를 바꾼다', async () => {
    await click('.items li:nth-child(2) button')
    expect(items()).toEqual(['useState', 'useMemo'])
    expect(ops()).toEqual(['REMOVE', 'TEXT']) // 항목 삭제 + 개수 글자
  })

  it('거르기: useMemo가 다시 계산하고 맞는 항목만 남긴다', async () => {
    await type('#query', 'Effect')
    expect(items()).toEqual(['useEffect'])
    expect(timeline().filter((line) => line.startsWith('useMemo')).at(-1)).toContain('다시 계산')
    expect($('.items + .hint').textContent).toBe('3개 중 1개 표시')
  })
})
