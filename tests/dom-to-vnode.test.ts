import { describe, expect, it } from 'vitest'
import { domToVNode } from '../src/core/dom-to-vnode'
import { findDuplicateKeys } from '../src/core/vnode'
import { vroot } from './helpers'

describe('domToVNode', () => {
  it('요소의 태그·속성·자식을 옮긴다', () => {
    expect(vroot('<P class="a" title="t">hi</P>').children).toEqual([
      { type: 'element', tag: 'p', props: { class: 'a', title: 't' }, children: [{ type: 'text', text: 'hi' }] },
    ])
  })

  it('data-key를 key로 읽고 속성에도 남긴다', () => {
    const [li] = vroot('<li data-key="a">A</li>').children
    expect(li).toMatchObject({ key: 'a', props: { 'data-key': 'a' } })
  })

  it('들여쓰기 공백과 주석은 버리고, 의미 있는 공백 한 칸은 남긴다', () => {
    const root = vroot('\n  <p><b>a</b> <i>b</i></p>\n  <!-- 주석 -->\n')
    expect(root.children).toHaveLength(1)
    const p = root.children[0]
    expect(p.type === 'element' && p.children.map((c) => c.type)).toEqual(['element', 'text', 'element'])
  })

  it('요소·텍스트가 아닌 노드는 null', () => {
    expect(domToVNode(document.createComment('x'))).toBeNull()
  })

  it('같은 부모 아래 겹치는 key를 찾는다', () => {
    expect(findDuplicateKeys(vroot('<ul><li data-key="a"></li><li data-key="a"></li></ul>'))).toEqual(['a'])
  })
})
