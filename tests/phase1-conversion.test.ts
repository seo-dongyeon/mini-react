import { describe, expect, it } from 'vitest'
import { domToVNode } from '../src/core/dom-to-vnode'
import { childrenToHtml, createElement } from '../src/core/render'
import { sanitize } from '../src/core/sanitize'
import { parseChildren, parseTree } from './phase1-fixtures'

describe('Phase 1 DOM과 Virtual DOM 변환', () => {
  it('태그, 속성, key, 텍스트, 자식 순서를 읽는다', () => {
    expect(parseChildren('<SECTION id="memo" data-key="a"><b>안녕</b> 세계</SECTION>')).toEqual([
      {
        type: 'element', tag: 'section', props: { id: 'memo', 'data-key': 'a' }, key: 'a',
        children: [
          { type: 'element', tag: 'b', props: {}, children: [{ type: 'text', text: '안녕' }] },
          { type: 'text', text: ' 세계' },
        ],
      },
    ])
  })

  it('주석과 들여쓰기 개행은 제외하고 인라인 공백은 보존한다', () => {
    expect(parseChildren('\n <b>a</b> <!-- 주석 --><i>b</i>\n')).toEqual([
      ...parseChildren('<b>a</b>'), { type: 'text', text: ' ' }, ...parseChildren('<i>b</i>'),
    ])
    expect(domToVNode(document.createComment('주석'))).toBeNull()
  })

  it.each([
    ['빈 영역', ''],
    ['중첩 태그', '<article><h2>제목</h2><ul><li data-key="a">항목</li></ul></article>'],
    ['텍스트와 인라인 요소', '<p>앞 <b>강조</b> 뒤 &amp; 끝</p>'],
    ['속성 이스케이프', '<a title="&quot; &amp; &lt;" href="/path?a=1&amp;b=2">&lt;내용&gt;</a>'],
    ['void 태그와 폼', '<div><input value="hello" checked><br><img alt="사진"><hr></div>'],
    ['표의 자동 tbody', '<table><tr><td>표</td></tr></table>'],
    ['여러 요소 루트', '<p>하나</p><p>둘</p>'],
    ['빈 key와 중복 key', '<ul><li data-key="">a</li><li data-key="">b</li></ul>'],
  ])('%s를 DOM으로 렌더링하고 HTML 편집기를 왕복해도 VDOM이 같다', (_name, html) => {
    const tree = parseTree(html)
    expect(domToVNode(createElement(tree))).toEqual(tree)
    expect(parseChildren(childrenToHtml(tree.children))).toEqual(tree.children)
  })

  it.each([
    ['최상위 텍스트와 요소', '앞 <b>강조</b> 뒤'],
    ['textarea 첫 개행', '<textarea>\n\n내용</textarea>'],
    ['pre의 의미 있는 공백', '<pre> \n </pre>'],
  ])('%s의 실제 텍스트가 변환과 편집기 왕복 후에도 보존된다', (_name, html) => {
    const original = document.createElement('div')
    original.innerHTML = html
    const tree = parseTree(html)
    const rendered = createElement(tree)
    const source = childrenToHtml(tree.children)
    const roundTrip = document.createElement('div')
    roundTrip.innerHTML = source
    expect(rendered.textContent).toBe(original.textContent)
    expect(roundTrip.textContent).toBe(original.textContent)
    // 브라우저 innerHTML은 textarea·pre의 첫 개행을 잃으므로, 편집기에 실제로 넣는 문자열로 왕복을 확인한다.
    expect(parseChildren(source)).toEqual(tree.children)
  })
})

describe('Phase 1 HTML 입력 정화', () => {
  it('스크립트 태그, 이벤트 속성, 스크립트 URL을 제거하고 일반 HTML을 보존한다', () => {
    const template = document.createElement('template')
    template.innerHTML = '<p class="ok" onclick="alert(1)">내용</p><script>alert(1)</script>'
      + '<a href="java&#10;script:alert(1)">위험</a><a href="https://example.com">안전</a>'
    const warnings = sanitize(template.content)
    expect(template.content.querySelector('script')).toBeNull()
    expect(template.content.querySelector('p')?.outerHTML).toBe('<p class="ok">내용</p>')
    expect(template.content.querySelector('a')?.hasAttribute('href')).toBe(false)
    expect(template.content.querySelectorAll('a')[1].getAttribute('href')).toBe('https://example.com')
    expect(warnings).toHaveLength(3)
    expect(sanitize(template.content)).toEqual([])
  })

  it('DOM 파서는 허용하지만 setAttribute가 거부하는 속성을 제거한다', () => {
    const template = document.createElement('template')
    template.innerHTML = '<p "bad="x">내용</p>'
    expect(sanitize(template.content)).toHaveLength(1)
    expect(() => parseChildren(template.innerHTML).map(createElement)).not.toThrow()
  })
})
