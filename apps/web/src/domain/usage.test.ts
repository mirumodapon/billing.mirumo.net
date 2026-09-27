import { describe, expect, it } from 'vitest'
import { makeExpense, makeTrip } from '../data/testing/fixtures'
import { openTestRepo } from '../test/renderApp'
import { recordUsage } from './usage'

describe('recordUsage', () => {
  it('counts live expenses in live trips only', async () => {
    const repo = await openTestRepo()
    await repo.saveTrip(makeTrip({ id: 'a' }))
    await repo.saveTrip(makeTrip({ id: 'b' }))
    await repo.saveTrip(makeTrip({ id: 'gone' }))
    await repo.saveExpense(makeExpense({ id: 'e1', tripId: 'a', categoryId: 'c1', paymentMethodId: 'p1' }))
    await repo.saveExpense(makeExpense({ id: 'e2', tripId: 'b', categoryId: 'c1', paymentMethodId: 'pay.cash' }))
    await repo.saveExpense(makeExpense({ id: 'e3', tripId: 'b', categoryId: 'c2', paymentMethodId: 'p1' }))
    await repo.deleteExpense('e3')
    await repo.saveExpense(makeExpense({ id: 'e4', tripId: 'gone', categoryId: 'c3', paymentMethodId: 'p3' }))
    await repo.deleteTrip('gone')
    expect(await recordUsage(repo)).toEqual({
      categories: { c1: 2 },
      paymentMethods: { p1: 1, 'pay.cash': 1 },
    })
  })
})
