import { describe, expect, it } from 'vitest'
import { budgetStatus, byCategory, byDay, contributionOf } from './stats'
import type { Expense, Trip } from './types'

const trip: Trip = {
  id: 't1',
  name: '東京五日遊',
  destination: '日本・東京',
  startDate: '2026-03-14',
  endDate: '2026-03-16',
  baseCurrency: 'TWD',
  members: [
    { id: 'a', name: '阿明', colorKey: 'accent1' },
    { id: 'b', name: '小美', colorKey: 'accent2' },
  ],
  selfMemberId: 'a',
  budget: { scope: 'self' },
  rates: { default: {}, byMethod: {} },
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
}

const ORDER = ['a', 'b']

function expense(over: Partial<Expense>): Expense {
  return {
    id: 'e',
    tripId: 't1',
    date: '2026-03-15',
    description: '',
    categoryId: 'cat.food',
    paymentMethodId: 'pay.cash',
    paidBy: 'b',
    amount: 200,
    currency: 'TWD',
    exchangeRate: 1,
    split: { mode: 'even', participants: ['a', 'b'] },
    attachments: [],
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-03-15T00:00:00Z',
    ...over,
  }
}

describe('contributionOf', () => {
  it('counts only my share under the self scope, regardless of who paid', () => {
    const e = expense({ paidBy: 'b', amount: 200 })
    expect(contributionOf(e, 'self', 'a', 'TWD', ORDER)).toBe(100)
  })

  it('counts the whole amount under the group scope', () => {
    const e = expense({ paidBy: 'b', amount: 200 })
    expect(contributionOf(e, 'group', 'a', 'TWD', ORDER)).toBe(200)
  })

  it('returns zero under the self scope when I did not participate', () => {
    const e = expense({ split: { mode: 'even', participants: ['b'] } })
    expect(contributionOf(e, 'self', 'a', 'TWD', ORDER)).toBe(0)
  })
})

describe('byCategory', () => {
  const opts = { scope: 'group' as const, selfMemberId: 'a', baseCurrency: 'TWD', memberOrder: ORDER }

  it('groups by category and sorts descending by amount', () => {
    const result = byCategory(
      [
        expense({ id: '1', categoryId: 'cat.food', amount: 300 }),
        expense({ id: '2', categoryId: 'cat.transport', amount: 500 }),
        expense({ id: '3', categoryId: 'cat.food', amount: 200 }),
      ],
      opts,
    )
    expect(result.map((r) => r.categoryId)).toEqual(['cat.food', 'cat.transport'])
    expect(result[0]!.totalMinor).toBe(500)
    expect(result[0]!.ratio).toBeCloseTo(0.5)
  })

  // 上面那組兩個類別剛好同為 500，穩定排序下順序不變，所以它分辨不出
  // 「有排序」和「照插入順序」。這組讓先出現的類別金額較小。
  it('sorts descending even when the first category encountered is smaller', () => {
    const result = byCategory(
      [
        expense({ id: '1', categoryId: 'cat.food', amount: 100 }),
        expense({ id: '2', categoryId: 'cat.transport', amount: 500 }),
      ],
      opts,
    )
    expect(result.map((r) => r.categoryId)).toEqual(['cat.transport', 'cat.food'])
  })

  it('merges slices below the threshold into cat.other', () => {
    const result = byCategory(
      [
        expense({ id: '1', categoryId: 'cat.food', amount: 9800 }),
        expense({ id: '2', categoryId: 'cat.transport', amount: 100 }),
        expense({ id: '3', categoryId: 'cat.shopping', amount: 100 }),
      ],
      { ...opts, mergeThreshold: 0.03 },
    )
    expect(result.map((r) => r.categoryId)).toEqual(['cat.food', 'cat.other'])
    expect(result[1]!.totalMinor).toBe(200)
  })

  it('ignores soft-deleted expenses', () => {
    const result = byCategory([expense({ deletedAt: '2026-03-16T00:00:00Z' })], opts)
    expect(result).toEqual([])
  })

  it('returns an empty list for no expenses', () => {
    expect(byCategory([], opts)).toEqual([])
  })
})

describe('byDay', () => {
  const opts = { scope: 'group' as const, selfMemberId: 'a', baseCurrency: 'TWD', memberOrder: ORDER }

  it('covers every day in the trip range even with no spending', () => {
    const result = byDay([expense({ date: '2026-03-15', amount: 300 })], { ...opts, trip })
    expect(result.map((d) => d.date)).toEqual(['2026-03-14', '2026-03-15', '2026-03-16'])
    expect(result[0]!.totalMinor).toBe(0)
    expect(result[1]!.totalMinor).toBe(300)
  })

  it('includes days outside the trip range that have spending', () => {
    const result = byDay([expense({ date: '2026-03-20', amount: 300 })], { ...opts, trip })
    expect(result.map((d) => d.date)).toContain('2026-03-20')
    expect(result[result.length - 1]!.date).toBe('2026-03-20')
  })

  it('flags days over the daily budget', () => {
    const result = byDay([expense({ date: '2026-03-15', amount: 800 })], {
      ...opts,
      trip,
      dailyBudgetMinor: 500,
    })
    expect(result.find((d) => d.date === '2026-03-15')!.overBudget).toBe(true)
    expect(result.find((d) => d.date === '2026-03-14')!.overBudget).toBe(false)
  })

  // 花掉剛好等於每日預算的金額不算超支。沒有這條的話，把 > 寫成 >=
  // 不會有任何測試變紅，而使用者會在正好花完預算的那天看到警示色。
  it('does not flag a day that spends exactly the daily budget', () => {
    const result = byDay([expense({ date: '2026-03-15', amount: 500 })], {
      ...opts,
      trip,
      dailyBudgetMinor: 500,
    })
    expect(result.find((d) => d.date === '2026-03-15')!.overBudget).toBe(false)
  })

  it('never flags anything when no daily budget is set', () => {
    const result = byDay([expense({ date: '2026-03-15', amount: 99999 })], { ...opts, trip })
    expect(result.every((d) => d.overBudget === false)).toBe(true)
  })
})

describe('budgetStatus', () => {
  it('reports normal below 80 percent', () => {
    const s = budgetStatus(700, 1000)
    expect(s.level).toBe('normal')
    expect(s.remainingMinor).toBe(300)
    expect(s.ratio).toBeCloseTo(0.7)
  })

  it('reports warning between 80 and 100 percent', () => {
    expect(budgetStatus(800, 1000).level).toBe('warning')
    expect(budgetStatus(1000, 1000).level).toBe('warning')
  })

  it('reports over above 100 percent with a negative remainder', () => {
    const s = budgetStatus(1200, 1000)
    expect(s.level).toBe('over')
    expect(s.remainingMinor).toBe(-200)
  })

  it('treats a zero budget as over once anything is spent', () => {
    expect(budgetStatus(1, 0).level).toBe('over')
    expect(budgetStatus(0, 0).level).toBe('normal')
  })
})
