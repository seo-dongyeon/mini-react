// 기능 테스트: index.html을 그대로 띄우고 버튼을 눌러 Phase 1 요구사항 흐름을 확인한다.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import html from '../index.html?raw'
import { domToVNode } from '../src/core/dom-to-vnode'
import type { VElement } from '../src/core/vnode'
import { vroot } from './helpers'

let actual: HTMLElement
let editor: HTMLTextAreaElement
let patchButton: HTMLButtonElement
let backButton: HTMLButtonElement
let forwardButton: HTMLButtonElement

beforeEach(async () => {
  vi.resetModules()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  document.body.replaceChildren(...Array.from(doc.body.childNodes))
  await import('../src/playground/main')
  actual = document.querySelector('#actual')!
  editor = document.querySelector('#editor')!
  patchButton = document.querySelector('#patch')!
  backButton = document.querySelector('#back')!
  forwardButton = document.querySelector('#forward')!
})

const position = () => document.querySelector('#position')!.textContent
const status = () => document.querySelector('#status')!.textContent ?? ''
const logItems = () => Array.from(document.querySelectorAll('#log li'), (li) => li.textContent)
const actualChildren = () => (domToVNode(actual) as VElement).children
const market = () => actual.querySelector('li[data-key="market"]')!

function edit(change: (html: string) => string): void {
  editor.value = change(editor.value)
  patchButton.click()
}

describe('페이지 로드', () => {
  it('실제 영역의 Virtual DOM으로 테스트 영역을 렌더링한다', () => {
    expect(vroot(editor.value).children).toEqual(actualChildren())
    expect(editor.value).toContain('<li data-key="hike">뒷산 산책</li>')
    expect(position()).toBe('1 / 1')
    expect(backButton.disabled).toBe(true)
    expect(forwardButton.disabled).toBe(true)
  })
})

describe('Patch', () => {
  it('바뀐 텍스트 하나만 실제 영역에 반영하고 나머지 노드는 그대로 둔다', () => {
    const dentist = actual.querySelector('[data-key="dentist"]')
    const hike = actual.querySelector('li[data-key="hike"]')

    edit((src) => src.replace('시장 구경', '시장 장보기'))

    expect(market().textContent).toBe('시장 장보기')
    expect(actual.querySelector('[data-key="dentist"]')).toBe(dentist)
    expect(actual.querySelector('li[data-key="hike"]')).toBe(hike)
    expect(logItems()).toEqual(['TEXT [3,1,0,0] → "시장 장보기"'])
    expect(status()).toContain('연산 1개, 실제 DOM 변경 1건')
    expect(position()).toBe('2 / 2')
  })

  it('속성 추가와 노드 추가를 한 번에 반영한다', () => {
    edit((src) => src.replace('<blockquote>', '<blockquote class="urgent">').replace('<li>빨래</li>', '<li>빨래</li>\n<li>설거지</li>'))

    expect(actual.querySelector('blockquote')!.className).toBe('urgent')
    expect(Array.from(actual.querySelectorAll('ol li'), (li) => li.textContent)).toEqual(['청소', '빨래', '설거지'])
    expect(logItems()).toHaveLength(2)
  })

  it('key가 있는 목록의 순서를 바꾸면 노드를 새로 만들지 않고 옮긴다', () => {
    const before = Array.from(actual.querySelectorAll('ul li'))

    edit((src) =>
      src.replace(
        /(<li data-key="market">.*?<\/li>)(\s*)(<li data-key="hike">.*?<\/li>)(\s*)(<li data-key="bread">.*?<\/li>)/,
        '$5$2$1$4$3',
      ),
    )

    const after = Array.from(actual.querySelectorAll('ul li'))
    expect(after.map((li) => li.textContent)).toEqual(['빵 굽기', '시장 구경', '뒷산 산책'])
    expect(new Set(after)).toEqual(new Set(before))
    expect(logItems()).toEqual(['MOVE [3,1,2] → [3,1]의 0번 자리'])
  })

  it('태그가 바뀌면 그 노드를 교체한다', () => {
    edit((src) => src.replace('<blockquote>늦으면 연체료 있음</blockquote>', '<p>늦으면 연체료 있음</p>'))

    expect(actual.querySelector('blockquote')).toBeNull()
    expect(logItems()[0]).toMatch(/^REPLACE .* → <p>$/)
  })

  it('바뀐 부분이 없으면 DOM도 기록도 건드리지 않는다', () => {
    edit((src) => src.replace(/\n {2}/g, '\n      ')) // 들여쓰기만 바꿈

    expect(logItems()).toEqual([])
    expect(status()).toContain('실제 DOM 변경 0건')
    expect(position()).toBe('1 / 1')
  })

  it('스크립트와 이벤트 속성은 실제 영역에 들어가지 않는다', () => {
    edit((src) => `${src}\n<script>window.hacked = 1</script>\n<img src="x" onerror="window.hacked = 1">`)

    expect(actual.querySelector('script')).toBeNull()
    expect(actual.querySelector('img')!.hasAttribute('onerror')).toBe(false)
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined()
    expect(document.querySelectorAll('#status .status__warning').length).toBeGreaterThan(0)
  })
})

describe('뒤로가기 · 앞으로가기', () => {
  it('저장된 Virtual DOM으로 실제 영역과 테스트 영역을 함께 되돌린다', () => {
    const original = editor.value
    edit((src) => src.replace('시장 구경', '시장 장보기'))
    const changed = editor.value

    backButton.click()
    expect(market().textContent).toBe('시장 구경')
    expect(editor.value).toBe(original)
    expect(position()).toBe('1 / 2')
    expect(backButton.disabled).toBe(true)

    forwardButton.click()
    expect(market().textContent).toBe('시장 장보기')
    expect(editor.value).toBe(changed)
    expect(forwardButton.disabled).toBe(true)
  })

  it('뒤로 간 상태에서 새로 Patch하면 앞쪽 기록은 버린다', () => {
    edit((src) => src.replace('시장 구경', '시장 장보기'))
    backButton.click()
    edit((src) => src.replace('빵 굽기', '케이크 굽기'))

    expect(position()).toBe('2 / 2')
    expect(forwardButton.disabled).toBe(true)
    expect(market().textContent).toBe('시장 구경')
    expect(actual.querySelector('li[data-key="bread"]')!.textContent).toBe('케이크 굽기')
  })

  it('이동한 뒤에도 실제 영역과 테스트 영역이 같은 Virtual DOM을 가리킨다', () => {
    edit((src) => src.replace('<ol>', '<ol start="3">').replace('청소', '분리수거'))
    backButton.click()
    expect(vroot(editor.value).children).toEqual(actualChildren())
    forwardButton.click()
    expect(vroot(editor.value).children).toEqual(actualChildren())
  })
})
