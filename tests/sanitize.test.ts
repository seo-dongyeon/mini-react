import { describe, expect, it } from 'vitest'
import { sanitize } from '../src/core/sanitize'

function clean(html: string): { html: string; warnings: string[] } {
  const template = document.createElement('template')
  template.innerHTML = html
  const warnings = sanitize(template.content)
  return { html: template.innerHTML, warnings }
}

describe('sanitize', () => {
  it('script·iframe 등 위험한 태그를 지운다', () => {
    const result = clean('<p>a</p><script>alert(1)</script><iframe src="x"></iframe><style>*{}</style>')
    expect(result.html).toBe('<p>a</p>')
    expect(result.warnings).toHaveLength(3)
  })

  it('on* 이벤트 속성을 지운다', () => {
    expect(clean('<img src="a.png" onerror="alert(1)" ONCLICK="x">').html).toBe('<img src="a.png">')
  })

  it('javascript: URL을 공백·대소문자를 섞어도 지운다', () => {
    expect(clean('<a href=" JaVa\tScript:alert(1)">x</a>').html).toBe('<a>x</a>')
    expect(clean('<a href="https://example.com">x</a>').html).toBe('<a href="https://example.com">x</a>')
  })

  it('지운 요소 안의 요소는 다시 경고하지 않는다', () => {
    expect(clean('<object><embed></object>').warnings).toHaveLength(1)
  })

  it('setAttribute가 거부하는 속성 이름을 지운다', () => {
    const result = clean('<p "a="1">x</p>')
    expect(result.html).toBe('<p>x</p>')
    expect(result.warnings[0]).toContain('잘못된 속성 이름')
  })

  it('안전한 입력은 그대로 둔다', () => {
    const html = '<ul class="a"><li data-key="1">하나</li></ul>'
    expect(clean(html)).toEqual({ html, warnings: [] })
  })
})
