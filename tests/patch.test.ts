import { describe, expect, it } from 'vitest'
import { diff } from '../src/core/diff'
import { patch } from '../src/core/patch'
import { createElement } from '../src/core/render'
import { vroot } from './helpers'

/** A를 그린 뒤 diff(A, B)를 patch한 결과가 B를 바로 그린 결과와 같은지 확인한다. */
function patchAndCompare(a: string, b: string): HTMLElement {
  const el = createElement(vroot(a)) as HTMLElement
  const result = patch(el, diff(vroot(a), vroot(b))) as HTMLElement
  expect(result.innerHTML).toBe((createElement(vroot(b)) as HTMLElement).innerHTML)
  return result
}

const list = (keys: string) => `<ul>${[...keys].map((k) => `<li data-key="${k}">${k}</li>`).join('')}</ul>`

describe('patch: 결과가 새 트리와 같다', () => {
  const cases: [string, string, string][] = [
    ['텍스트', '<p>a</p>', '<p>b</p>'],
    ['속성', '<p class="a" title="t">x</p>', '<p class="b">x</p>'],
    ['추가', '<p>a</p>', '<p>a</p><p>b</p><p>c</p>'],
    ['삭제', '<p>a</p><p>b</p><p>c</p>', '<p>a</p>'],
    ['앞쪽 삭제 + 뒤쪽 수정', '<p>a</p><p>b</p><p>c</p>', '<p>b</p><p>z</p>'],
    ['교체', '<p><b>a</b></p>', '<div><i>z</i></div>'],
    ['텍스트 ↔ 요소', 'a', '<b>a</b>'],
    ['중첩', '<div><ul><li>1</li></ul></div>', '<div><ul><li>1</li><li>2</li></ul><p>x</p></div>'],
    ['key 이동', list('abcde'), list('edcba')],
    ['key 추가·삭제·이동', list('abcd'), list('dxbz')],
    ['key 전부 교체', list('abc'), list('xyz')],
    ['빈 목록에서 시작', '<ul></ul>', list('ab')],
    ['빈 목록으로', list('ab'), '<ul></ul>'],
  ]
  it.each(cases)('%s', (_, a, b) => {
    patchAndCompare(a, b)
  })
})

describe('patch: 바뀐 부분만 건드린다', () => {
  it('안 바뀐 형제 노드는 같은 객체 그대로다', () => {
    const el = createElement(vroot('<p>a</p><p>b</p>')) as HTMLElement
    const first = el.firstChild
    patch(el, diff(vroot('<p>a</p><p>b</p>'), vroot('<p>a</p><p>c</p>')))
    expect(el.firstChild).toBe(first)
  })

  it('key로 이동한 노드는 새로 만들지 않고 옮긴다', () => {
    const el = createElement(vroot(list('abc'))) as HTMLElement
    const before = Array.from(el.querySelectorAll('li'))
    patch(el, diff(vroot(list('abc')), vroot(list('cab'))))
    const after = Array.from(el.querySelectorAll('li'))
    expect(after).toEqual([before[2], before[0], before[1]])
  })

  it('루트가 교체되면 새 루트를 돌려준다', () => {
    const el = createElement({ type: 'element', tag: 'div', props: {}, children: [] })
    const next = patch(el, diff({ type: 'element', tag: 'div', props: {}, children: [] }, { type: 'element', tag: 'section', props: {}, children: [] }))
    expect((next as Element).tagName).toBe('SECTION')
  })

  it('DOM과 VDOM이 어긋나면 엉뚱한 노드를 고치지 않고 멈춘다', () => {
    const el = document.createElement('div')
    expect(() => patch(el, [{ type: 'TEXT', path: [3, 0], text: 'x' }])).toThrow(/경로/)
  })
})

describe('patch: key 목록 무작위 검증', () => {
  // 고정 시드 난수: 실패하면 같은 입력으로 다시 재현할 수 있다.
  let seed = 42
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)

  it('무작위 추가·삭제·재정렬 300회', () => {
    const pool = 'abcdefghij'
    const pick = () => [...pool].filter(() => random() < 0.6).sort(() => random() - 0.5).join('')
    for (let i = 0; i < 300; i++) patchAndCompare(list(pick()), list(pick()))
  })
})
