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
  // task#136 起 TWD 也是兩位小數：最小單位是 0.01 元
  it('converts each member amount to base minor units', () => {
    // 各 ¥1,900，匯率 0.21 → 各 NT$399
    const result = splitExact({ a: 1900, b: 1900 }, 0.21, 79800, 'TWD', ORDER)
    expect(result).toEqual({ a: 39900, b: 39900 })
  })

  it('reconciles rounding drift so the shares still sum to the total', () => {
    // 三人各 ¥1,266.67，逐筆換算後加總可能少於或多於總額
    const result = splitExact(
      { a: 1266.67, b: 1266.67, c: 1266.66 },
      0.21,
      79800,
      'TWD',
      ORDER,
    )
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(79800)
  })

  // 上面那組數字剛好無漂移，所以它無法證明 reconcile 是必要的。
  // 以下兩組是實際會漂移的輸入：拿掉 reconcile 就會失敗。
  it('absorbs positive drift, where per-member conversion undershoots the total', () => {
    // 1.10×0.21 → 0.23，3.40×0.21 → 0.71，逐筆加總 0.94；
    // 整筆 4.50×0.21 → 0.95。差額 +1 分要落在 memberOrder 的第一人身上。
    const result = splitExact({ a: 1.1, b: 3.4 }, 0.21, 95, 'TWD', ORDER)
    expect(result).toEqual({ a: 24, b: 71 })
    expect(sum(result)).toBe(95)
  })

  it('absorbs negative drift, where per-member conversion overshoots the total', () => {
    // 1.08×0.21 → 0.23，3.36×0.21 → 0.71，逐筆加總 0.94；
    // 整筆 4.44×0.21 → 0.93。差額 −1 分同樣從第一人身上扣。
    const result = splitExact({ a: 1.08, b: 3.36 }, 0.21, 93, 'TWD', ORDER)
    expect(sum(result)).toBe(93)
    expect(result).toEqual({ a: 22, b: 71 })
  })

  it('supports a member paying nothing', () => {
    const result = splitExact({ a: 3800, b: 0 }, 0.21, 79800, 'TWD', ORDER)
    expect(result).toEqual({ a: 79800, b: 0 })
  })

  // 其他案例的 amounts 鍵序剛好與 ORDER 一致，所以它們無法分辨
  // 「有把 memberOrder 傳下去」和「用了物件自己的鍵序」。這裡刻意倒著寫。
  it('settles drift by memberOrder, not by the key order of the amounts object', () => {
    // 與上面的正向漂移同一組數字，只是 b 先寫。差額 +1 仍必須落在 a 身上。
    const result = splitExact({ b: 3.4, a: 1.1 }, 0.21, 95, 'TWD', ORDER)
    expect(result).toEqual({ a: 24, b: 71 })
  })

  it('returns an empty record when there are no amounts', () => {
    expect(splitExact({}, 0.21, 79800, 'TWD', ORDER)).toEqual({})
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

  // 收據上同時有商品與退貨／優惠券時，shares 會混正負。權重若不取絕對值，
  // Math.trunc 朝零取整會把負項抬高，assigned 越過 diffMinor 而 step 仍朝原方向走，
  // 迴圈永遠回不到終止條件——整個 App 同步凍結，不是算錯而是當掉。
  it('terminates and sums correctly when shares have mixed signs', () => {
    const result = distribute({ a: -1, b: -1, c: 5 }, 2, 'prorata', ORDER)
    expect(sum(result)).toBe(5)
    expect(result).toEqual({ a: -1, b: -1, c: 7 })
  })

  it('terminates for a large mixed-sign difference', () => {
    const result = distribute({ a: -393, b: -1, c: 398 }, 246, 'prorata', ORDER)
    expect(sum(result)).toBe(250)
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
    const result = splitByItems(items, 'prorata', 1, 380000, 'TWD', ORDER)
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(380000)
  })

  it('charges a member only for the items they participated in', () => {
    const result = splitByItems(items, 'prorata', 1, 340000, 'TWD', ORDER)
    // c 只參與生啤：1720 / 3 人 = 573.33
    expect(result.c).toBe(57333)
  })

  it('excludes members who participated in nothing', () => {
    const result = splitByItems(items, 'prorata', 1, 340000, 'TWD', ORDER)
    expect(result.d).toBeUndefined()
  })

  it('handles a discount (items exceed the paid total)', () => {
    const result = splitByItems(items, 'prorata', 1, 300000, 'TWD', ORDER)
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(300000)
  })

  // 上面幾條只斷言加總，而加總光靠 reconcile 就會對——就算 distribute 什麼都沒做。
  // 以下釘住完整分佈，這樣「跳過 distribute」或「把 prorata 當 even」都會被抓到。
  it('spreads the service charge in proportion to what each member consumed', () => {
    // 明細分攤：a 1653.34、b 1173.33、c 573.33，小計 3400；實付 3800 的差額 400 按比例攤回
    expect(splitByItems(items, 'prorata', 1, 340000, 'TWD', ORDER)).toEqual({
      a: 165334,
      b: 117333,
      c: 57333,
    })
    expect(splitByItems(items, 'prorata', 1, 380000, 'TWD', ORDER)).toEqual({
      a: 184785,
      b: 131137,
      c: 64078,
    })
  })

  it('spreads the difference evenly under the even rule', () => {
    // 同一筆差額，even 規則的分佈與 prorata 明顯不同
    expect(splitByItems(items, 'even', 1, 380000, 'TWD', ORDER)).toEqual({
      a: 178668,
      b: 130666,
      c: 70666,
    })
  })

  // 所有 items fixture 的 participants 都已經是 memberOrder 的順序，
  // 所以它們分辨不出「有排序」和「照原陣列順序分」。這裡刻意倒著寫。
  it('splits an item by memberOrder, not by the order its participants were listed', () => {
    const shared: LineItem[] = [
      { id: 'i1', name: '共享拼盤', amount: 10.01, participants: ['c', 'a'] },
    ]
    // 10.01 元分兩人，餘數 1 分必須歸 memberOrder 在前的 a；未排序的話會歸 c
    expect(splitByItems(shared, 'prorata', 1, 1001, 'TWD', ORDER)).toEqual({ a: 501, c: 500 })
  })

  it('returns the discount in proportion to consumption', () => {
    expect(splitByItems(items, 'prorata', 1, 300000, 'TWD', ORDER)).toEqual({
      a: 145883,
      b: 103529,
      c: 50588,
    })
  })

  it('applies the exchange rate to item amounts', () => {
    const one: LineItem[] = [{ id: 'i1', name: '', amount: 1000, participants: ['a', 'b'] }]
    const result = splitByItems(one, 'prorata', 0.21, 21000, 'TWD', ORDER)
    expect(result).toEqual({ a: 10500, b: 10500 })
  })

  // 一張「退貨 + 折扣 + 新商品」的收據，負數品項是使用者輸入優惠券的自然方式。
  // 修正前這個呼叫會讓公開 API sharesOf 永不返回。
  it('handles a receipt mixing refunds and purchases without hanging', () => {
    const mixed: LineItem[] = [
      { id: 'i1', name: '退貨', amount: -393, participants: ['a'] },
      { id: 'i2', name: '折扣', amount: -1, participants: ['b'] },
      { id: 'i3', name: '新商品', amount: 398, participants: ['c'] },
    ]
    const result = splitByItems(mixed, 'prorata', 1, 25000, 'TWD', ORDER)
    expect(sum(result)).toBe(25000)
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
    // ¥3,801.05 × 0.21 = NT$798.22：四人分，餘下的 2 分歸 memberOrder 前兩人
    const e = makeExpense({ mode: 'even', participants: ['a', 'b', 'c', 'd'] }, 3801.05)
    const result = sharesOf(e, 'TWD', ORDER)
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(79822)
    expect(result).toEqual({ a: 19956, b: 19956, c: 19955, d: 19955 })
  })

  it('dispatches to splitExact', () => {
    const e = makeExpense({ mode: 'exact', amounts: { a: 2000, b: 1800 } })
    const result = sharesOf(e, 'TWD', ORDER)
    // 3800 × 0.21 = 798
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(79800)
    // 只斷言加總分辨不出模式——均分兩人也是 798。要釘住分佈：
    // ¥2,000×0.21 = 420、¥1,800×0.21 = 378，而均分會是 {a:399, b:399}。
    expect(result).toEqual({ a: 42000, b: 37800 })
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
    expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(79800)
    // a 獨享拉麵又分了啤酒，b 只分啤酒，所以差距遠大於均分
    expect(result).toEqual({ a: 63371, b: 16429 })
  })

  // 型別合法但無意義的分攤設定。UI 不該產生，匯入的備份可能帶進來。
  // 回傳 {} 會讓這筆錢從結算裡消失、Σ net 不再為零。
  it('charges the whole total to the payer when the split names nobody', () => {
    for (const split of [
      { mode: 'even', participants: [] },
      { mode: 'exact', amounts: {} },
      { mode: 'items', overflowRule: 'prorata', items: [] },
      { mode: 'items', overflowRule: 'prorata', items: [{ id: 'i', name: '', amount: 1000, participants: [] }] },
    ] satisfies Split[]) {
      const e = makeExpense(split)
      // 3800 × 0.21 = 798，付款人是 a
      expect(sharesOf(e, 'TWD', ORDER)).toEqual({ a: 79800 })
    }
  })

  it('sorts even-split participants into member order regardless of input order', () => {
    const e = makeExpense({ mode: 'even', participants: ['d', 'b', 'a', 'c'] }, 3801.05)
    expect(sharesOf(e, 'TWD', ORDER)).toEqual({ a: 19956, b: 19956, c: 19955, d: 19955 })
  })
})
