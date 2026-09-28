import { describe, expect, it } from 'vitest'
import { makeExpense, makeTrip } from '../data/testing/fixtures'
import { storedBalances, storedMethodIds } from './storedValue'

const trip = makeTrip({
  paymentMethods: [
    { id: 'suica', name: 'Suica', storedValue: { currency: 'JPY' } },
    { id: 'kiosk', name: '便利商店卡' },
  ],
})

/** 情境：儲值 5,000 円（信用卡付），用 Suica 搭車 200 與 300 円 */
const topUp = makeExpense({ id: 'top', amount: 5000, currency: 'JPY', paymentMethodId: 'pay.credit', topUpFor: 'suica' })
const ride1 = makeExpense({ id: 'r1', amount: 200, currency: 'JPY', paymentMethodId: 'suica', fromBalance: true })
const ride2 = makeExpense({ id: 'r2', amount: 300, currency: 'JPY', paymentMethodId: 'suica', fromBalance: true })

describe('storedMethodIds (task#115)', () => {
  it('lists only the trip’s stored-value methods', () => {
    expect([...storedMethodIds(trip)]).toEqual(['suica'])
    expect(storedMethodIds(makeTrip()).size).toBe(0)
  })
})

describe('storedBalances (task#115)', () => {
  it('adds top-ups and takes away payments made with the card', () => {
    expect(storedBalances(trip, [topUp, ride1, ride2])).toEqual({ suica: { currency: 'JPY', minor: 450000 } })
  })

  it('starts at zero before the first top-up, and can go below it', () => {
    expect(storedBalances(trip, [])).toEqual({ suica: { currency: 'JPY', minor: 0 } })
    expect(storedBalances(trip, [ride1]).suica?.minor).toBe(-20000)
  })

  // 刪掉的與草稿都不算：草稿還沒成立，刪掉的已經不在
  it('ignores deleted records and drafts', () => {
    const gone = { ...ride1, deletedAt: '2026-03-16T00:00:00.000Z' }
    const pending = { ...ride2, draft: true }
    expect(storedBalances(trip, [topUp, gone, pending]).suica?.minor).toBe(500000)
  })
})
