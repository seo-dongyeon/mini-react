import { describe, expect, it } from 'vitest'
import { History } from '../src/playground/history'

describe('History', () => {
  it('처음엔 뒤로·앞으로 모두 갈 수 없다', () => {
    const history = new History('v0')
    expect([history.canBack, history.canForward, history.back(), history.forward()]).toEqual([
      false,
      false,
      undefined,
      undefined,
    ])
  })

  it('뒤로 갔다가 앞으로 온다', () => {
    const history = new History('v0')
    history.push('v1')
    history.push('v2')
    expect(history.back()).toBe('v1')
    expect(history.back()).toBe('v0')
    expect(history.forward()).toBe('v1')
    expect(history.position).toEqual({ index: 1, length: 3 })
  })

  it('뒤로 간 상태에서 새로 넣으면 앞쪽 기록을 버린다', () => {
    const history = new History('v0')
    history.push('v1')
    history.push('v2')
    history.back()
    history.back()
    history.push('w1')
    expect(history.current).toBe('w1')
    expect(history.canForward).toBe(false)
    expect(history.position).toEqual({ index: 1, length: 2 })
  })
})
