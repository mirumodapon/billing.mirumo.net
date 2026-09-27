import { describe, expect, it } from 'vitest'
import { makeExpense, makeTrip } from '../data/testing/fixtures'
import { openTestRepo } from '../test/renderApp'
import { summarizeTrip, summarizeTrips } from './summarizeTrips'

describe('summarizeTrip', () => {
  it('adds up the whole group’s spending in the home currency', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 1000, currency: 'JPY', exchangeRate: 0.21 }),
      makeExpense({ id: 'e2', amount: 500, currency: 'TWD', exchangeRate: 1 }),
    ]
    expect(summarizeTrip(makeTrip(), expenses).spentMinor).toBe(210 + 500)
  })

  it('leaves out deleted expenses', () => {
    const expenses = [makeExpense({ id: 'e1', amount: 100, exchangeRate: 1 }), makeExpense({ id: 'e2', amount: 900, exchangeRate: 1, deletedAt: 'x' })]
    expect(summarizeTrip(makeTrip(), expenses).spentMinor).toBe(100)
  })

  // 規格 3.6：預算為 undefined 時所有進度條與警示一律不渲染
  it('has no budget status when no total budget is set', () => {
    expect(summarizeTrip(makeTrip({ budget: { scope: 'group' } }), [makeExpense()]).budget).toBeUndefined()
  })

  // self 口徑問的是「我該負擔多少」，不是我先墊了多少
  it('measures the budget in the trip’s own scope', () => {
    const expense = makeExpense({ amount: 1000, currency: 'TWD', exchangeRate: 1, paidBy: 'a', split: { mode: 'even', participants: ['a', 'b'] } })
    const self = summarizeTrip(makeTrip({ budget: { total: 800, scope: 'self' } }), [expense]).budget!
    expect([self.usedMinor, self.level]).toEqual([500, 'normal'])
    const group = summarizeTrip(makeTrip({ budget: { total: 800, scope: 'group' } }), [expense]).budget!
    expect([group.usedMinor, group.level]).toEqual([1000, 'over'])
  })

  it('compares against the budget in minor units of the home currency', () => {
    const trip = makeTrip({ baseCurrency: 'USD', budget: { total: 12.5, scope: 'group' } })
    const expense = makeExpense({ amount: 10, currency: 'USD', exchangeRate: 1 })
    expect(summarizeTrip(trip, [expense]).budget).toMatchObject({ budgetMinor: 1250, usedMinor: 1000 })
  })

  it('treats a zero budget as set, not as missing', () => {
    expect(summarizeTrip(makeTrip({ budget: { total: 0, scope: 'group' } }), []).budget).toBeDefined()
  })
})

describe('summarizeTrips', () => {
  it('summarises every trip it is given, including trips with no expenses', async () => {
    const repo = await openTestRepo()
    const a = await repo.saveTrip(makeTrip({ id: 'a1' }))
    const b = await repo.saveTrip(makeTrip({ id: 'b1' }))
    await repo.saveExpense(makeExpense({ tripId: 'a1', amount: 100, currency: 'TWD', exchangeRate: 1 }))
    const summaries = await summarizeTrips(repo, [a, b])
    expect(summaries).toEqual({ a1: { spentMinor: 100 }, b1: { spentMinor: 0 } })
  })
})
