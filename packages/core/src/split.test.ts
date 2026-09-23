import { describe, expect, it } from 'vitest'
import { reconcile, sortByMemberOrder, splitEven, splitExact } from './split'

const ORDER = ['a', 'b', 'c', 'd']

const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0)

describe('sortByMemberOrder', () => {
  it('orders ids by their position in memberOrder', () => {
    expect(sortByMemberOrder(['c', 'a', 'b'], ORDER)).toEqual(['a', 'b', 'c'])
  })

  it('puts ids missing from memberOrder at the end, stably', () => {
    expect(sortByMemberOrder(['z', 'b', 'y'], ORDER)).toEqual(['b', 'z', 'y'])
  })
})

describe('splitEven', () => {
  it('divides evenly when there is no remainder', () => {
    expect(splitEven(800, ['a', 'b', 'c', 'd'])).toEqual({ a: 200, b: 200, c: 200, d: 200 })
  })

  it('gives the remainder to the earliest members in order', () => {
    // 3800 / 4 = 950 餘 0... 用 799 / 4 = 199 餘 3
    expect(splitEven(799, ['a', 'b', 'c', 'd'])).toEqual({ a: 200, b: 200, c: 200, d: 199 })
  })

  it('always sums to the total', () => {
    for (const total of [1, 7, 99, 100, 3800, 12345]) {
      for (const k of [1, 2, 3, 4, 5, 7]) {
        const participants = ORDER.concat(['e', 'f', 'g']).slice(0, k)
        expect(sum(splitEven(total, participants))).toBe(total)
      }
    }
  })

  it('handles a single participant', () => {
    expect(splitEven(3800, ['a'])).toEqual({ a: 3800 })
  })

  it('handles zero total', () => {
    expect(splitEven(0, ['a', 'b'])).toEqual({ a: 0, b: 0 })
  })

  it('returns an empty record for no participants', () => {
    expect(splitEven(100, [])).toEqual({})
  })

  it('distributes negative totals without losing the remainder', () => {
    expect(sum(splitEven(-799, ['a', 'b', 'c', 'd']))).toBe(-799)
  })
})

describe('reconcile', () => {
  it('leaves shares untouched when they already sum to the target', () => {
    const shares = { a: 200, b: 200 }
    expect(reconcile(shares, 400, ORDER)).toEqual({ a: 200, b: 200 })
  })

  it('adds a positive difference one minor unit at a time, in member order', () => {
    expect(reconcile({ a: 100, b: 100 }, 203, ORDER)).toEqual({ a: 102, b: 101 })
  })

  it('removes a negative difference the same way', () => {
    expect(reconcile({ a: 100, b: 100 }, 197, ORDER)).toEqual({ a: 98, b: 99 })
  })

  it('does not mutate its input', () => {
    const shares = { a: 100, b: 100 }
    reconcile(shares, 205, ORDER)
    expect(shares).toEqual({ a: 100, b: 100 })
  })

  it('returns an empty record when there are no shares', () => {
    expect(reconcile({}, 500, ORDER)).toEqual({})
  })
})

describe('splitExact', () => {
  it('converts each member amount to base minor units', () => {
    // 各 ¥1,900，匯率 0.21 → NT$399 各自
    const result = splitExact({ a: 1900, b: 1900 }, 0.21, 798, 'TWD', ORDER)
    expect(result).toEqual({ a: 399, b: 399 })
  })

  it('reconciles rounding drift so the shares still sum to the total', () => {
    // 三人各 ¥1,266.67，逐筆換算後加總可能少於或多於總額
    const result = splitExact(
      { a: 1266.67, b: 1266.67, c: 1266.66 },
      0.21,
      798,
      'TWD',
      ORDER,
    )
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(798)
  })

  // 上面那組數字剛好無漂移，所以它無法證明 reconcile 是必要的。
  // 以下兩組是實際會漂移的輸入：拿掉 reconcile 就會失敗。
  it('absorbs positive drift, where per-member conversion undershoots the total', () => {
    // 173.58×0.21 → 36，3739.91×0.21 → 785，逐筆加總 821；
    // 整筆 3913.49×0.21 → 822。差額 +1 要落在 memberOrder 的第一人身上。
    const result = splitExact({ a: 173.58, b: 3739.91 }, 0.21, 822, 'TWD', ORDER)
    expect(result).toEqual({ a: 37, b: 785 })
    expect(sum(result)).toBe(822)
  })

  it('absorbs negative drift, where per-member conversion overshoots the total', () => {
    // 3907.26×0.21 → 821，3154.78×0.21 → 663，逐筆加總 1484；
    // 整筆 7062.04×0.21 → 1483。差額 −1 同樣從第一人身上扣。
    const result = splitExact({ a: 3907.26, b: 3154.78 }, 0.21, 1483, 'TWD', ORDER)
    expect(sum(result)).toBe(1483)
    expect(result).toEqual({ a: 820, b: 663 })
  })

  it('supports a member paying nothing', () => {
    const result = splitExact({ a: 3800, b: 0 }, 0.21, 798, 'TWD', ORDER)
    expect(result).toEqual({ a: 798, b: 0 })
  })

  // 其他案例的 amounts 鍵序剛好與 ORDER 一致，所以它們無法分辨
  // 「有把 memberOrder 傳下去」和「用了物件自己的鍵序」。這裡刻意倒著寫。
  it('settles drift by memberOrder, not by the key order of the amounts object', () => {
    // 與上面的正向漂移同一組數字，只是 b 先寫。差額 +1 仍必須落在 a 身上。
    const result = splitExact({ b: 3739.91, a: 173.58 }, 0.21, 822, 'TWD', ORDER)
    expect(result).toEqual({ a: 37, b: 785 })
  })

  it('returns an empty record when there are no amounts', () => {
    expect(splitExact({}, 0.21, 798, 'TWD', ORDER)).toEqual({})
  })
})
