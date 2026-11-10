import { afterEach, describe, expect, it } from 'vitest'
import { diff } from '../src/core/diff'
import { domToVNode } from '../src/core/dom-to-vnode'
import { patch } from '../src/core/patch'
import { createElement } from '../src/core/render'
import { findDuplicateKeys } from '../src/core/vnode'
import { parseTree } from './phase1-fixtures'

afterEach(() => document.body.replaceChildren())

describe('Phase 1 Diff와 Patch', () => {
  it.each([
    ['변경 없음', '<p>동일</p>', '<p>동일</p>', []],
    ['자식 추가', '<ul></ul>', '<ul><li>새 항목</li></ul>', ['INSERT']],
    ['자식 삭제', '<ul><li>삭제</li></ul>', '<ul></ul>', ['REMOVE']],
    ['태그 변경', '<p><b>이전</b></p>', '<section><i>이후</i></section>', ['REPLACE']],
    ['속성 추가', '<p>내용</p>', '<p class="new">내용</p>', ['SET_PROP']],
    ['속성 수정', '<p title="old">내용</p>', '<p title="new">내용</p>', ['SET_PROP']],
    ['속성 삭제', '<p title="old">내용</p>', '<p>내용</p>', ['REMOVE_PROP']],
    ['텍스트 변경', '<p>이전</p>', '<p>이후</p>', ['TEXT']],
    ['텍스트를 요소로 변경', '<p>이전</p>', '<p><b>이후</b></p>', ['REPLACE']],
    ['요소를 텍스트로 변경', '<p><b>이전</b></p>', '<p>이후</p>', ['REPLACE']],
  ])('%s 연산과 최종 DOM이 정확하다', (_name, before, after, types) => {
    const oldTree = parseTree(before)
    const nextTree = parseTree(after)
    const snapshots = JSON.stringify([oldTree, nextTree])
    const root = createElement(oldTree)
    const originalHtml = (root as Element).outerHTML
    const ops = diff(oldTree, nextTree)
    expect(ops.map((op) => op.type)).toEqual(types)
    expect((root as Element).outerHTML).toBe(originalHtml)
    expect(domToVNode(patch(root, ops))).toEqual(nextTree)
    expect(JSON.stringify([oldTree, nextTree])).toBe(snapshots)
  })

  it('연결된 루트의 교체 결과를 반환한다', () => {
    const oldTree = parseTree('<p>old</p>').children[0]
    const nextTree = parseTree('<section>new</section>').children[0]
    const root = createElement(oldTree)
    document.body.append(root)
    const replacement = patch(root, diff(oldTree, nextTree))
    expect(replacement).toBe(document.body.firstChild)
    expect(replacement).not.toBe(root)
    expect(domToVNode(replacement)).toEqual(nextTree)
  })

  it('여러 형제의 삭제와 깊은 경로 수정을 함께 처리한다', () => {
    const oldTree = parseTree('<main><p>a</p><section><b>b</b><i>c</i><em>d</em></section><p>e</p></main>')
    const nextTree = parseTree('<main><p>A</p><section><strong>B</strong></section></main>')
    const root = createElement(oldTree)
    expect(domToVNode(patch(root, diff(oldTree, nextTree)))).toEqual(nextTree)
  })

  it('텍스트 하나를 바꿀 때 해당 Text만 수정하고 다른 노드와 이벤트를 보존한다', () => {
    const oldTree = parseTree('<article><p>이전</p><button>클릭</button></article>')
    const nextTree = parseTree('<article><p>이후</p><button>클릭</button></article>')
    const root = createElement(oldTree) as HTMLElement
    document.body.append(root)
    const paragraph = root.querySelector('p')!
    const text = paragraph.firstChild
    const button = root.querySelector('button')!
    let clicks = 0
    button.addEventListener('click', () => clicks++)
    const observer = new MutationObserver(() => {})
    observer.observe(root, { childList: true, characterData: true, attributes: true, subtree: true })
    patch(root, diff(oldTree, nextTree))
    const records = observer.takeRecords()
    observer.disconnect()
    expect(root.querySelector('p')).toBe(paragraph)
    expect(paragraph.firstChild).toBe(text)
    expect(root.querySelector('button')).toBe(button)
    expect(records.map((record) => record.type)).toEqual(['characterData'])
    button.click()
    expect(clicks).toBe(1)
  })

  it('동일 상태의 Patch는 DOM mutation을 만들지 않는다', () => {
    const tree = parseTree('<p>그대로</p>')
    const root = createElement(tree)
    const observer = new MutationObserver(() => {})
    observer.observe(root, { childList: true, characterData: true, attributes: true, subtree: true })
    expect(patch(root, diff(tree, tree))).toBe(root)
    expect(observer.takeRecords()).toEqual([])
    observer.disconnect()
  })

  it('사용자가 수정한 input의 value와 checked도 속성 변경에 맞춘다', () => {
    const oldTree = parseTree('<input value="old"><input type="checkbox" checked>')
    const nextTree = parseTree('<input value="new"><input type="checkbox">')
    const root = createElement(oldTree) as HTMLElement
    const [text, checkbox] = root.querySelectorAll('input')
    text.value = '사용자가 입력'
    checkbox.checked = true
    patch(root, diff(oldTree, nextTree))
    expect(text.value).toBe('new')
    expect(checkbox.checked).toBe(false)
    const removed = parseTree('<input><input type="checkbox" checked>')
    patch(root, diff(nextTree, removed))
    expect(text.value).toBe('')
    expect(checkbox.checked).toBe(true)
  })

  it('존재하지 않는 경로는 변경 전에 오류를 낸다', () => {
    const root = createElement(parseTree('<p>원본</p>')) as HTMLElement
    expect(() => patch(root, [
      { type: 'SET_PROP', path: [0], name: 'title', value: '변경' },
      { type: 'TEXT', path: [9], text: '오류' },
    ])).toThrow('patch: 경로')
    expect(root.innerHTML).toBe('<p>원본</p>')
  })
})

function orders(keys: string[]): string[][] {
  return [[], ...keys.flatMap((key) => orders(keys.filter((item) => item !== key)).map((rest) => [key, ...rest]))]
}

function keyedHtml(keys: string[], changed = false): string {
  return '<ul>' + keys.map((key) => `<li data-key="${key}"><span>${changed ? key.toUpperCase() : key}</span></li>`).join('') + '</ul>'
}

describe('Phase 1 key 재정렬과 경계 조건', () => {
  it('세 key의 모든 부분집합·순열 사이 256개 전환에서 결과와 노드 재사용을 검증한다', () => {
    const states = orders(['a', 'b', 'c'])
    expect(states).toHaveLength(16)
    for (const before of states) {
      for (const after of states) {
        const context = `${before.join(',')} → ${after.join(',')}`
        const oldTree = parseTree(keyedHtml(before))
        const nextTree = parseTree(keyedHtml(after, true))
        const root = createElement(oldTree) as HTMLElement
        const originals = new Map(Array.from(root.querySelectorAll('li')).map((node) => [node.dataset.key, node]))
        patch(root, diff(oldTree, nextTree))
        expect(domToVNode(root), context).toEqual(nextTree)
        if (before.length === 0 || after.length === 0) continue
        for (const key of after.filter((key) => before.includes(key))) {
          expect(root.querySelector(`[data-key="${key}"]`), context).toBe(originals.get(key))
        }
      }
    }
  })

  it.each([
    ['같은 key의 태그 교체와 이동', '<p data-key="a">a</p><p data-key="b">b</p><p data-key="c">c</p>', '<section data-key="c">C</section><p data-key="a">A</p><p data-key="b">B</p>'],
    ['중첩 key 목록을 동시에 이동', '<div data-key="a"><b data-key="x">x</b><b data-key="y">y</b></div><div data-key="b">b</div>', '<div data-key="b">B</div><div data-key="a"><b data-key="y">Y</b><i data-key="z">z</i><b data-key="x">X</b></div>'],
    ['중복 key의 위치 비교', '<p data-key="a">1</p><p data-key="a">2</p>', '<p data-key="a">2</p><p data-key="a">1</p><p data-key="b">3</p>'],
    ['key와 텍스트 혼합', '<p data-key="a">a</p> 사이 <p data-key="b">b</p>', '<p data-key="b">B</p> 변경 <p data-key="a">A</p>'],
    ['key 없는 목록 중간 삽입', '<ul><li>a</li><li>c</li></ul>', '<ul><li>a</li><li>b</li><li>c</li></ul>'],
  ])('%s 후 DOM이 목표 트리와 같다', (_name, before, after) => {
    const oldTree = parseTree(before)
    const nextTree = parseTree(after)
    const root = createElement(oldTree)
    expect(domToVNode(patch(root, diff(oldTree, nextTree)))).toEqual(nextTree)
    expect(domToVNode(patch(root, diff(nextTree, oldTree)))).toEqual(oldTree)
  })

  it('한 번의 MOVE로 회전하며 제자리 input의 포커스와 값을 보존한다', () => {
    const oldTree = parseTree('<input data-key="a" value="a"><input data-key="b" value="b"><input data-key="c" value="c">')
    const nextTree = parseTree('<input data-key="c" value="c"><input data-key="a" value="a"><input data-key="b" value="b">')
    const root = createElement(oldTree) as HTMLElement
    document.body.append(root)
    const input = root.querySelector<HTMLInputElement>('[data-key="a"]')!
    input.value = '입력 중'
    input.focus()
    input.setSelectionRange(1, 3)
    const ops = diff(oldTree, nextTree)
    expect(ops.map((op) => op.type)).toEqual(['MOVE'])
    patch(root, ops)
    expect(root.children[1]).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('입력 중')
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3])
  })

  it('중복 key는 같은 부모 안에서만 감지한다', () => {
    expect(findDuplicateKeys(parseTree('<ul><li data-key="x"></li><li data-key="x"></li></ul>'))).toEqual(['x'])
    expect(findDuplicateKeys(parseTree('<ul><li data-key="x"></li></ul><ul><li data-key="x"></li></ul>'))).toEqual([])
  })
})
