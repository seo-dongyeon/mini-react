import { describe, expect, it } from 'vitest'
import { diff, longestIncreasingSubsequence } from '../src/core/diff'
import { vroot } from './helpers'

const ops = (a: string, b: string) => diff(vroot(a), vroot(b))

describe('diff: 핵심 케이스 5가지', () => {
  it('1. 노드 추가', () => {
    expect(ops('<p>a</p>', '<p>a</p><p>b</p>')).toEqual([
      { type: 'INSERT', parent: [], index: 1, node: vroot('<p>b</p>').children[0] },
    ])
  })

  it('2. 노드 삭제', () => {
    expect(ops('<p>a</p><p>b</p>', '<p>a</p>')).toEqual([{ type: 'REMOVE', path: [1] }])
  })

  it('3. 태그가 다르면 하위 트리째 교체하고 안쪽은 비교하지 않는다', () => {
    expect(ops('<p><b>a</b></p>', '<div><b>z</b></div>')).toEqual([
      { type: 'REPLACE', path: [0], node: vroot('<div><b>z</b></div>').children[0] },
    ])
  })

  it('4. 속성 변경·추가·삭제', () => {
    expect(ops('<p class="a" title="t">x</p>', '<p class="b" id="i">x</p>')).toEqual([
      { type: 'SET_PROP', path: [0], name: 'class', value: 'b' },
      { type: 'SET_PROP', path: [0], name: 'id', value: 'i' },
      { type: 'REMOVE_PROP', path: [0], name: 'title' },
    ])
  })

  it('5. 텍스트 변경', () => {
    expect(ops('<p>a</p>', '<p>b</p>')).toEqual([{ type: 'TEXT', path: [0, 0], text: 'b' }])
  })

  it('같으면 연산이 없다', () => {
    expect(ops('<ul><li data-key="a">A</li></ul>', '<ul><li data-key="a">A</li></ul>')).toEqual([])
  })
})

describe('diff: key 재정렬', () => {
  const list = (keys: string) => `<ul>${[...keys].map((k) => `<li data-key="${k}">${k}</li>`).join('')}</ul>`

  it('맨 뒤를 맨 앞으로 옮기면 MOVE 하나', () => {
    expect(ops(list('abc'), list('cab'))).toEqual([{ type: 'MOVE', path: [0, 2], parent: [0], index: 0 }])
  })

  it('key 없이 비교하면 같은 변경이 텍스트 변경 3개가 된다', () => {
    const plain = (s: string) => `<ul>${[...s].map((k) => `<li>${k}</li>`).join('')}</ul>`
    expect(ops(plain('abc'), plain('cab')).map((op) => op.type)).toEqual(['TEXT', 'TEXT', 'TEXT'])
  })

  it('추가·삭제·이동이 섞여도 이전 트리 기준 주소를 쓴다', () => {
    const result = ops(list('abcd'), list('dxb'))
    expect(result).toEqual(
      expect.arrayContaining([
        { type: 'REMOVE', path: [0, 0] },
        { type: 'REMOVE', path: [0, 2] },
        { type: 'INSERT', parent: [0], index: 1, node: expect.objectContaining({ key: 'x' }) },
      ]),
    )
    expect(result.filter((op) => op.type === 'MOVE')).toHaveLength(1)
  })

  it('같은 key인데 태그가 바뀌면 삭제 후 추가', () => {
    expect(ops('<ul><li data-key="a">A</li></ul>', '<ul><p data-key="a">A</p></ul>').map((op) => op.type)).toEqual([
      'REMOVE',
      'INSERT',
    ])
  })

  it('key가 겹치면 위치끼리 비교한다', () => {
    const dup = '<ul><li data-key="a">1</li><li data-key="a">2</li></ul>'
    const swapped = '<ul><li data-key="a">2</li><li data-key="a">1</li></ul>'
    expect(ops(dup, swapped).map((op) => op.type)).toEqual(['TEXT', 'TEXT'])
  })
})

describe('longestIncreasingSubsequence', () => {
  it('-1은 건너뛰고 증가 수열의 위치를 돌려준다', () => {
    expect([...longestIncreasingSubsequence([2, 0, 1, -1, 3])].sort()).toEqual([1, 2, 4])
    expect(longestIncreasingSubsequence([]).size).toBe(0)
  })
})
