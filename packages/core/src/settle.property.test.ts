import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { minimalTransfers, netBalances } from './settle'
import type { Expense, Split, Transfer, Trip } from './types'

/**
 * 這支檔案守的是整條結算鏈，而不是個別函式。
 *
 * settle.test.ts 裡每個 minimalTransfers 案例都用手寫的 Balance，
 * 所以它們驗得了貪婪演算法，卻驗不到「netBalances 產出的東西餵給
 * minimalTransfers 之後真的能把所有人清乾淨」。那正是使用者在結算頁
 * 看到的東西，也是 Σ net === 0 這條保證唯一會被看見的地方。
 */

const MEMBERS = ['a', 'b', 'c', 'd', 'e']

const memberIds = fc.uniqueArray(fc.constantFrom(...MEMBERS), { minLength: 2, maxLength: 5 })

function makeTrip(ids: string[]): Trip {
  return {
    id: 't1',
    name: '',
    destination: '',
    startDate: '2026-03-01',
    endDate: '2026-03-10',
    baseCurrency: 'TWD',
    members: ids.map((id) => ({ id, name: id, colorKey: 'accent1' as const })),
    selfMemberId: ids[0]!,
    budget: { scope: 'self' },
    rates: { default: {}, byMethod: {} },
    createdAt: '',
    updatedAt: '',
  }
}

/** 三種分攤模式都要涵蓋——結算不該因為支出用了哪種模式而表現不同 */
function splitArb(ids: string[]): fc.Arbitrary<Split> {
  const participants = fc
    .uniqueArray(fc.constantFrom(...ids), { minLength: 1, maxLength: ids.length })
  return fc.oneof(
    participants.map((p) => ({ mode: 'even', participants: p }) as Split),
    participants.chain((p) =>
      fc
        .array(fc.integer({ min: 0, max: 5000 }), { minLength: p.length, maxLength: p.length })
        .map(
          (amounts) =>
            ({
              mode: 'exact',
              amounts: Object.fromEntries(p.map((id, i) => [id, amounts[i] ?? 0])),
            }) as Split,
        ),
    ),
    participants.chain((p) =>
      fc
        .array(
          fc.record({
            amount: fc.integer({ min: -2000, max: 5000 }),
            participants: fc.uniqueArray(fc.constantFrom(...ids), { minLength: 1, maxLength: ids.length }),
          }),
          { minLength: 1, maxLength: 4 },
        )
        .map(
          (items) =>
            ({
              mode: 'items',
              overflowRule: 'prorata',
              items: items.map((it, i) => ({ id: `i${i}`, name: '', ...it })),
            }) as Split,
        )
        .map((s) => (p.length > 0 ? s : s)),
    ),
  )
}

function expenseArb(ids: string[]): fc.Arbitrary<Expense> {
  return fc
    .record({
      id: fc.string({ minLength: 1, maxLength: 4 }),
      paidBy: fc.constantFrom(...ids),
      amount: fc.integer({ min: 1, max: 50_000 }),
      exchangeRate: fc.constantFrom(1, 0.21, 0.023, 1.2345),
      split: splitArb(ids),
      deleted: fc.boolean(),
    })
    .map((r) => ({
      id: r.id,
      tripId: 't1',
      date: '2026-03-05',
      description: '',
      categoryId: 'cat.food',
      paymentMethodId: 'pay.cash',
      paidBy: r.paidBy,
      amount: r.amount,
      currency: 'X',
      exchangeRate: r.exchangeRate,
      split: r.split,
      attachments: [],
      createdAt: '',
      updatedAt: '',
      ...(r.deleted ? { deletedAt: '2026-03-06' } : {}),
    }))
}

function transferArb(ids: string[]): fc.Arbitrary<Transfer> {
  return fc
    .record({
      id: fc.string({ minLength: 1, maxLength: 4 }),
      fromIndex: fc.nat(),
      offset: fc.integer({ min: 1, max: 4 }),
      amount: fc.integer({ min: 1, max: 20_000 }),
      exchangeRate: fc.constantFrom(1, 0.21, 0.023),
    })
    .map((r) => {
      const from = ids[r.fromIndex % ids.length]!
      const to = ids[(r.fromIndex + r.offset) % ids.length]!
      return {
        id: r.id,
        tripId: 't1',
        date: '2026-03-06',
        from,
        to,
        amount: r.amount,
        currency: 'X',
        exchangeRate: r.exchangeRate,
        kind: 'settlement' as const,
        note: '',
        createdAt: '',
        updatedAt: '',
      }
    })
    .filter((t) => t.from !== t.to)
}

const scenario = memberIds.chain((ids) =>
  fc.record({
    ids: fc.constant(ids),
    expenses: fc.array(expenseArb(ids), { minLength: 0, maxLength: 5 }),
    transfers: fc.array(transferArb(ids), { minLength: 0, maxLength: 3 }),
  }),
)

describe('settlement chain invariants', () => {
  it('always produces balances that sum to exactly zero', () => {
    fc.assert(
      fc.property(scenario, ({ ids, expenses, transfers }) => {
        const balances = netBalances(makeTrip(ids), expenses, transfers)
        expect(balances.reduce((acc, b) => acc + b.netMinor, 0)).toBe(0)
        expect(balances).toHaveLength(ids.length)
      }),
      { numRuns: 2000 },
    )
  })

  it('always produces transfers that clear every member', () => {
    fc.assert(
      fc.property(scenario, ({ ids, expenses, transfers }) => {
        const balances = netBalances(makeTrip(ids), expenses, transfers)
        const suggested = minimalTransfers(balances)

        const net: Record<string, number> = Object.fromEntries(
          balances.map((b) => [b.memberId, b.netMinor]),
        )
        for (const t of suggested) {
          net[t.from] = (net[t.from] ?? 0) + t.amountMinor
          net[t.to] = (net[t.to] ?? 0) - t.amountMinor
        }
        expect(Object.values(net).every((v) => v === 0)).toBe(true)
      }),
      { numRuns: 2000 },
    )
  })

  it('never suggests more than n-1 transfers, nor a zero or self transfer', () => {
    fc.assert(
      fc.property(scenario, ({ ids, expenses, transfers }) => {
        const balances = netBalances(makeTrip(ids), expenses, transfers)
        const suggested = minimalTransfers(balances)
        expect(suggested.length).toBeLessThanOrEqual(ids.length - 1)
        expect(suggested.every((t) => t.amountMinor > 0 && t.from !== t.to)).toBe(true)
      }),
      { numRuns: 2000 },
    )
  })

  it('leaves the balances it was given untouched, and is reproducible', () => {
    fc.assert(
      fc.property(scenario, ({ ids, expenses, transfers }) => {
        const balances = netBalances(makeTrip(ids), expenses, transfers)
        const frozen = JSON.stringify(balances)
        const first = minimalTransfers(balances)
        expect(JSON.stringify(balances)).toBe(frozen)
        expect(minimalTransfers(balances)).toEqual(first)
      }),
      { numRuns: 1000 },
    )
  })
})
