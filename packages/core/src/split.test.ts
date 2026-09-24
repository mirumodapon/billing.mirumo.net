import { describe, expect, it } from 'vitest'
import { distribute, reconcile, sharesOf, sortByMemberOrder, splitByItems, splitEven, splitExact } from './split'
import type { Expense, LineItem, Split } from './types'

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

describe('distribute', () => {
  it('spreads a positive difference proportionally to existing shares', () => {
    // 服務費 400：a 佔 50%、b 佔 29%、c 佔 21%
    const result = distribute({ a: 1700, b: 1000, c: 700 }, 400, 'prorata', ORDER)
    expect(result.a! + result.b! + result.c!).toBe(3800)
    expect(result.a).toBeGreaterThan(result.b!)
    expect(result.b).toBeGreaterThan(result.c!)
  })

  it('spreads a difference evenly when the rule is even', () => {
    const result = distribute({ a: 1700, b: 1000, c: 700 }, 300, 'even', ORDER)
    expect(result).toEqual({ a: 1800, b: 1100, c: 800 })
  })

  it('handles a negative difference (a discount) proportionally', () => {
    const result = distribute({ a: 2000, b: 1000 }, -300, 'prorata', ORDER)
    expect(result.a! + result.b!).toBe(2700)
    // 折扣依消費比例回饋：a 拿到較多折扣
    expect(2000 - result.a!).toBeGreaterThan(1000 - result.b!)
  })

  it('is a no-op when the difference is zero', () => {
    expect(distribute({ a: 100, b: 200 }, 0, 'prorata', ORDER)).toEqual({ a: 100, b: 200 })
  })

  it('falls back to even distribution when all shares are zero', () => {
    // 無法按比例分配，否則會除以零
    const result = distribute({ a: 0, b: 0 }, 10, 'prorata', ORDER)
    expect(result.a! + result.b!).toBe(10)
  })

  // 上面的 prorata 案例只斷言了排序（a > b > c），而 even 也滿足那個排序，
  // 所以它分辨不出兩種規則。這兩條釘住完整分佈。
  it('distributes prorata in proportion, not evenly', () => {
    expect(distribute({ a: 1700, b: 1000, c: 700 }, 400, 'prorata', ORDER)).toEqual({
      a: 1900,
      b: 1118,
      c: 782,
    })
    // 同一筆差額用 even 規則會得到完全不同的分佈
    expect(distribute({ a: 1700, b: 1000, c: 700 }, 400, 'even', ORDER)).toEqual({
      a: 1834,
      b: 1133,
      c: 833,
    })
  })

  // 餘數比較若走浮點，決勝依據會從 memberOrder 變成表示誤差。
  // 這組三人的精確餘數完全相等（都是 2），必須由 memberOrder 決勝、歸 a。
  it('breaks exact ties by memberOrder, not by floating-point noise', () => {
    // (4/6)×−200 在 IEEE 754 下是 −133.33333333333334，而 (1/6)×−200 是
    // −33.333333333333336：b 與 c 的小數部分被誤差墊高約 1e-14，會搶走 a 的單位。
    expect(distribute({ a: 4, b: 1, c: 1 }, -200, 'prorata', ORDER)).toEqual({
      a: -130,
      b: -32,
      c: -32,
    })
  })

  it('gives the leftover unit to the largest fractional part, not the first member', () => {
    // 1/6、2/6、3/6 的 2 單位 → 商 0、0、1，餘 1 單位歸小數部分最大的 b（0.667）
    expect(distribute({ a: 1, b: 2, c: 3 }, 2, 'prorata', ORDER)).toEqual({ a: 1, b: 3, c: 4 })
    // 反向排列，確認不是碰巧：這次餘數歸 a
    expect(distribute({ a: 5, b: 3, c: 1 }, 2, 'prorata', ORDER)).toEqual({ a: 6, b: 4, c: 1 })
  })
})

describe('splitByItems', () => {
  const items: LineItem[] = [
    { id: 'i1', name: '豚骨拉麵', amount: 1200, participants: ['a', 'b'] },
    { id: 'i2', name: '煎餃', amount: 480, participants: ['a'] },
    { id: 'i3', name: '生啤 x3', amount: 1720, participants: ['a', 'b', 'c'] },
  ]

  it('splits each item among its own participants and sums to the total', () => {
    // 小計 3400，實付 3800，差額 400 按比例攤回
    const result = splitByItems(items, 'prorata', 1, 3800, 'TWD', ORDER)
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(3800)
  })

  it('charges a member only for the items they participated in', () => {
    const result = splitByItems(items, 'prorata', 1, 3400, 'TWD', ORDER)
    // c 只參與生啤：1720 / 3 人
    expect(result.c).toBe(573)
  })

  it('excludes members who participated in nothing', () => {
    const result = splitByItems(items, 'prorata', 1, 3400, 'TWD', ORDER)
    expect(result.d).toBeUndefined()
  })

  it('handles a discount (items exceed the paid total)', () => {
    const result = splitByItems(items, 'prorata', 1, 3000, 'TWD', ORDER)
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(3000)
  })

  // 上面幾條只斷言加總，而加總光靠 reconcile 就會對——就算 distribute 什麼都沒做。
  // 以下釘住完整分佈，這樣「跳過 distribute」或「把 prorata 當 even」都會被抓到。
  it('spreads the service charge in proportion to what each member consumed', () => {
    // 明細分攤：a 1654、b 1173、c 573，小計 3400；實付 3800 的差額 400 按比例攤回
    expect(splitByItems(items, 'prorata', 1, 3400, 'TWD', ORDER)).toEqual({
      a: 1654,
      b: 1173,
      c: 573,
    })
    expect(splitByItems(items, 'prorata', 1, 3800, 'TWD', ORDER)).toEqual({
      a: 1849,
      b: 1311,
      c: 640,
    })
  })

  it('spreads the difference evenly under the even rule', () => {
    // 同一筆差額，even 規則的分佈與 prorata 明顯不同
    expect(splitByItems(items, 'even', 1, 3800, 'TWD', ORDER)).toEqual({
      a: 1788,
      b: 1306,
      c: 706,
    })
  })

  // 所有 items fixture 的 participants 都已經是 memberOrder 的順序，
  // 所以它們分辨不出「有排序」和「照原陣列順序分」。這裡刻意倒著寫。
  it('splits an item by memberOrder, not by the order its participants were listed', () => {
    const shared: LineItem[] = [
      { id: 'i1', name: '共享拼盤', amount: 1001, participants: ['c', 'a'] },
    ]
    // 1001 分兩人，餘數 1 必須歸 memberOrder 在前的 a；未排序的話會歸 c
    expect(splitByItems(shared, 'prorata', 1, 1001, 'TWD', ORDER)).toEqual({ a: 501, c: 500 })
  })

  it('returns the discount in proportion to consumption', () => {
    expect(splitByItems(items, 'prorata', 1, 3000, 'TWD', ORDER)).toEqual({
      a: 1459,
      b: 1035,
      c: 506,
    })
  })

  it('applies the exchange rate to item amounts', () => {
    const one: LineItem[] = [{ id: 'i1', name: '', amount: 1000, participants: ['a', 'b'] }]
    const result = splitByItems(one, 'prorata', 0.21, 210, 'TWD', ORDER)
    expect(result).toEqual({ a: 105, b: 105 })
  })

  it('returns an empty record for no items', () => {
    expect(splitByItems([], 'prorata', 1, 0, 'TWD', ORDER)).toEqual({})
  })
})

function makeExpense(split: Split, amount = 3800, exchangeRate = 0.21): Expense {
  return {
    id: 'e1',
    tripId: 't1',
    date: '2026-03-15',
    description: '一蘭拉麵',
    categoryId: 'cat.food',
    paymentMethodId: 'pay.cash',
    paidBy: 'a',
    amount,
    currency: 'JPY',
    exchangeRate,
    split,
    attachments: [],
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-03-15T00:00:00Z',
  }
}

describe('sharesOf', () => {
  it('dispatches to splitEven and sums to the converted total', () => {
    const e = makeExpense({ mode: 'even', participants: ['a', 'b', 'c', 'd'] })
    const result = sharesOf(e, 'TWD', ORDER)
    // 3800 × 0.21 = 798
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(798)
    expect(result).toEqual({ a: 200, b: 200, c: 199, d: 199 })
  })

  it('dispatches to splitExact', () => {
    const e = makeExpense({ mode: 'exact', amounts: { a: 2000, b: 1800 } })
    const result = sharesOf(e, 'TWD', ORDER)
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(798)
  })

  it('dispatches to splitByItems', () => {
    const e = makeExpense({
      mode: 'items',
      overflowRule: 'prorata',
      items: [
        { id: 'i1', name: '拉麵', amount: 2000, participants: ['a'] },
        { id: 'i2', name: '啤酒', amount: 1400, participants: ['a', 'b'] },
      ],
    })
    const result = sharesOf(e, 'TWD', ORDER)
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(798)
  })

  it('sorts even-split participants into member order regardless of input order', () => {
    const e = makeExpense({ mode: 'even', participants: ['d', 'b', 'a', 'c'] })
    expect(sharesOf(e, 'TWD', ORDER)).toEqual({ a: 200, b: 200, c: 199, d: 199 })
  })
})
