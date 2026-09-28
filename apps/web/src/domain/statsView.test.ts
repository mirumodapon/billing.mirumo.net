import type { Trip } from '@billing/core'
import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { t } from '../i18n'
import { makeExpense, makeTrip } from '../data/testing/fixtures'
import { statsView } from './statsView'

const categories = defaultSettings().categories

/**
 * 手算情境（Plan 9 驗收）：三人、本位幣 TWD、旅程 3/14–3/16
 * - e1 阿明付 3000，三人均分（餐飲）→ 各 1000
 * - e2 小美付 1200，小美與大熊均分（交通）→ 各 600
 * - 草稿 9999 不算
 */
const trip: Trip = makeTrip({ startDate: '2026-03-14', endDate: '2026-03-16' })
const expenses = [
  makeExpense({ id: 'e1', date: '2026-03-14', paidBy: 'a', amount: 3000, currency: 'TWD', exchangeRate: 1, categoryId: 'cat.food', split: { mode: 'even', participants: ['a', 'b', 'c'] } }),
  makeExpense({ id: 'e2', date: '2026-03-15', paidBy: 'b', amount: 1200, currency: 'TWD', exchangeRate: 1, categoryId: 'cat.transport', split: { mode: 'even', participants: ['b', 'c'] } }),
  makeExpense({ id: 'd', date: '2026-03-15', paidBy: 'a', amount: 9999, currency: 'TWD', exchangeRate: 1, draft: true }),
]

describe('statsView: totals per scope (spec 3.5)', () => {
  it('adds up whole expenses for the group', () => {
    expect(statsView(trip, expenses, 'group', categories).totalMinor).toBe(4200)
  })

  // 「我」問的是我該負擔多少：小美付的那筆我沒分到，我付的那筆只算我那一份
  it('adds up only my share for me, whoever paid', () => {
    expect(statsView(trip, expenses, 'self', categories).totalMinor).toBe(1000)
  })
})

describe('statsView: category share', () => {
  it('lists categories largest first, with names and colours from the settings', () => {
    const view = statsView(trip, expenses, 'group', categories)
    expect(view.categories.map((c) => [c.key, c.value])).toEqual([
      ['cat.food', 3000],
      ['cat.transport', 1200],
    ])
    expect(view.categories[0]).toMatchObject({ label: t('cat.food'), colorKey: categories.find((c) => c.id === 'cat.food')!.colorKey })
  })

  it('leaves out categories I have no share in', () => {
    expect(statsView(trip, expenses, 'self', categories).categories.map((c) => c.key)).toEqual(['cat.food'])
  })

  it('folds categories under 3% into other (spec 3.5)', () => {
    const tiny = makeExpense({ id: 't', paidBy: 'a', amount: 100, currency: 'TWD', exchangeRate: 1, categoryId: 'cat.shopping' })
    const view = statsView(trip, [...expenses, tiny], 'group', categories)
    expect(view.categories.map((c) => c.key)).toEqual(['cat.food', 'cat.transport', 'cat.other'])
  })
})

describe('statsView: daily spending', () => {
  it('has a day for every trip date, in order', () => {
    expect(statsView(trip, expenses, 'group', categories).days.map((d) => [d.key, d.value])).toEqual([
      ['2026-03-14', 3000],
      ['2026-03-15', 1200],
      ['2026-03-16', 0],
    ])
  })
})

describe('statsView: budget (spec 3.6, Plan 9 T2/T3)', () => {
  const budgeted = makeTrip({ startDate: '2026-03-14', endDate: '2026-03-16', budget: { total: 5000, daily: 2000, scope: 'group' } })

  it('has no budget when none is set', () => {
    expect(statsView(trip, expenses, 'group', categories).budget).toBeUndefined()
  })

  // 預算是旅程設定：不論現在看哪個口徑，都用預算自己的口徑算
  it('measures the budget in its own scope whichever scope is shown', () => {
    for (const scope of ['group', 'self'] as const) {
      expect(statsView(budgeted, expenses, scope, categories).budget).toMatchObject({ usedMinor: 4200, budgetMinor: 5000, remainingMinor: 800 })
    }
  })

  it('draws the daily budget only when it is in the scope being shown', () => {
    expect(statsView(budgeted, expenses, 'group', categories).dailyBudgetMinor).toBe(2000)
    expect(statsView(budgeted, expenses, 'self', categories).dailyBudgetMinor).toBeUndefined()
  })
})

describe('statsView: members and my items', () => {
  it('compares what each member owes, for the group only', () => {
    expect(statsView(trip, expenses, 'group', categories).members?.map((m) => [m.id, m.owedMinor])).toEqual([
      ['a', 1000],
      ['b', 1600],
      ['c', 1600],
    ])
    expect(statsView(trip, expenses, 'self', categories).members).toBeUndefined()
  })

  it('lists what I shared in, largest first, for me only', () => {
    const lunch = makeExpense({ id: 'l', paidBy: 'b', amount: 900, currency: 'TWD', exchangeRate: 1, description: '午餐', split: { mode: 'even', participants: ['a', 'b', 'c'] } })
    const view = statsView(trip, [...expenses, lunch], 'self', categories)
    expect(view.items?.rows.map((r) => [r.expenseId, r.shareMinor])).toEqual([
      ['e1', 1000],
      ['l', 300],
    ])
    expect(view.items?.overflowMinor).toBe(0)
    expect(statsView(trip, expenses, 'group', categories).items).toBeUndefined()
  })
})

describe('statsView: from another member (per-member stats)', () => {
  // 小美：晚餐 1000 + 地鐵 600，付款人是誰不影響
  it('adds up the chosen member’s share', () => {
    const view = statsView(trip, expenses, 'self', categories, 'b')
    expect(view.totalMinor).toBe(1600)
    expect(view.categories.map((c) => [c.key, c.value])).toEqual([
      ['cat.food', 1000],
      ['cat.transport', 600],
    ])
    expect(view.items?.rows.map((r) => [r.expenseId, r.shareMinor])).toEqual([
      ['e1', 1000],
      ['e2', 600],
    ])
  })

  // 個人預算是「我」的預算：看別人時不畫每日預算線，總預算仍照原樣算
  it('keeps the budget mine and draws my daily budget only for me', () => {
    const mine = makeTrip({ startDate: '2026-03-14', endDate: '2026-03-16', budget: { total: 5000, daily: 2000, scope: 'self' } })
    expect(statsView(mine, expenses, 'self', categories, 'b').budget?.usedMinor).toBe(1000)
    expect(statsView(mine, expenses, 'self', categories, 'b').dailyBudgetMinor).toBeUndefined()
    expect(statsView(mine, expenses, 'self', categories, 'a').dailyBudgetMinor).toBe(2000)
  })
})

describe('statsView: items name their expense (task#112)', () => {
  it('gives each item row the description of the expense it came from', () => {
    const izakaya = makeExpense({
      id: 'iz',
      description: '居酒屋',
      paidBy: 'b',
      amount: 1000,
      currency: 'TWD',
      exchangeRate: 1,
      split: { mode: 'items', overflowRule: 'even', items: [{ id: 'i1', name: '生啤', amount: 1000, participants: ['a', 'b'] }] },
    })
    const rows = statsView(trip, [...expenses, izakaya], 'self', categories).items!.rows
    expect(rows.find((r) => r.itemId === 'i1')).toMatchObject({ name: '生啤', expenseName: '居酒屋' })
    expect(rows.find((r) => r.expenseId === 'e1')).toMatchObject({ itemId: null, expenseName: '' })
  })
})
