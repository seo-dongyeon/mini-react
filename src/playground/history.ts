/**
 * 브라우저 방문 기록과 같은 방식의 상태 기록.
 * 뒤로 간 상태에서 새 항목을 넣으면 현재 위치 뒤의 기록은 버린다.
 */
export class History<T> {
  private items: T[]
  private index = 0

  constructor(initial: T) {
    this.items = [initial]
  }

  get current(): T {
    return this.items[this.index]
  }

  get position(): { index: number; length: number } {
    return { index: this.index, length: this.items.length }
  }

  get canBack(): boolean {
    return this.index > 0
  }

  get canForward(): boolean {
    return this.index < this.items.length - 1
  }

  push(item: T): void {
    this.items = this.items.slice(0, this.index + 1)
    this.items.push(item)
    this.index = this.items.length - 1
  }

  back(): T | undefined {
    if (!this.canBack) return undefined
    return this.items[--this.index]
  }

  forward(): T | undefined {
    if (!this.canForward) return undefined
    return this.items[++this.index]
  }
}
