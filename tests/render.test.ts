import { describe, expect, it } from 'vitest'
import { childrenToHtml, createElement } from '../src/core/render'
import { vroot } from './helpers'

describe('createElement', () => {
  it('VNode를 같은 구조의 실제 DOM으로 만든다', () => {
    const el = createElement(vroot('<ul class="a"><li data-key="x">A &amp; B</li></ul>')) as HTMLElement
    expect(el.innerHTML).toBe('<ul class="a"><li data-key="x">A &amp; B</li></ul>')
  })

  it('checked·value는 화면 값(프로퍼티)도 맞춘다', () => {
    const el = createElement(vroot('<input type="checkbox" checked><input value="v">')) as HTMLElement
    const [box, text] = Array.from(el.querySelectorAll('input'))
    expect(box.checked).toBe(true)
    expect(text.value).toBe('v')
  })
})

describe('childrenToHtml', () => {
  it('요소만 있으면 들여쓰고, 텍스트가 섞이면 한 줄로 쓴다', () => {
    expect(childrenToHtml(vroot('<ul><li>a <b>b</b></li><li>c</li></ul>').children)).toBe(
      '<ul>\n  <li>a <b>b</b></li>\n  <li>c</li>\n</ul>',
    )
  })

  it('void 요소는 닫는 태그가 없다', () => {
    expect(childrenToHtml(vroot('<p>a<br>b</p><img src="x">').children)).toBe('<p>a<br>b</p>\n<img src="x">')
  })

  it('텍스트와 속성 값을 이스케이프해서 구조가 깨지지 않는다', () => {
    const tricky = '<p title="a &quot;b&quot; <c>">1 &lt; 2 &amp;&amp; <b>x</b></p>'
    const once = vroot(tricky)
    expect(vroot(childrenToHtml(once.children))).toEqual(once)
  })

  it('왕복(VNode → HTML → VNode)해도 같은 트리가 된다', () => {
    const sample = `
      <article class="note" data-key="a">
        <h3>제목 → <strong>3시</strong></h3>
        <ul><li data-key="x">하나</li><li data-key="y">둘</li></ul>
        <label><input type="checkbox" checked> 우유</label>
      </article>`
    const once = vroot(sample)
    expect(vroot(childrenToHtml(once.children))).toEqual(once)
  })

  it('최상위에 텍스트가 섞이면 개행을 넣지 않는다', () => {
    expect(childrenToHtml(vroot('앞 <b>강조</b> 뒤').children)).toBe('앞 <b>강조</b> 뒤')
  })

  it.each([
    ['최상위 텍스트와 요소', '앞 <b>강조</b> 뒤'],
    ['textarea 첫 개행', '<textarea>\n\n내용</textarea>'],
    ['textarea 개행만', '<textarea>\n\n\n</textarea>'],
    ['textarea 특수문자', '<textarea>\n\n<b>&amp;</b></textarea>'],
    ['pre 공백만', '<pre> \n </pre>'],
    ['pre 첫 개행과 중첩 태그', '<pre>\n\n<b>a</b>\n  <i> b </i></pre>'],
    ['pre 안 요소만', '<pre><b>a</b><i>b</i></pre>'],
    ['들여쓴 부모 안의 pre', '<div><p>x</p><pre>  a\n  b</pre></div>'],
  ])('공백 보존 왕복: %s', (_, html) => {
    const once = vroot(html)
    const text = childrenToHtml(once.children)
    expect(vroot(text)).toEqual(once)
    expect(childrenToHtml(vroot(text).children)).toBe(text) // 두 번째 왕복도 같은 문자열
  })
})
