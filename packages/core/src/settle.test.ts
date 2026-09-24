import { describe, expect, it } from 'vitest'
import { minimalTransfers, netBalances } from './settle'
import type { Balance } from './settle'
import type { Expense, Transfer, Trip } from './types'

const trip: Trip = {
  id: 't1',
  name: '東京五日遊',
  destination: '日本・東京',
  startDate: '2026-03-14',
  endDate: '2026-03-18',
  baseCurrency: 'TWD',
  members: [
    { id: 'a', name: '阿明', colorKey: 'accent1' },
    { id: 'b', name: '小美', colorKey: 'accent2' },
    { id: 'c', name: '大熊', colorKey: 'accent3' },
  ],
  selfMemberId: 'a',
  budget: { scope: 'self' },
  rates: { default: {}, byMethod: {} },
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
}

function expense(over: Partial<Expense>): Expense {
  return {
    id: 'e',
    tripId: 't1',
    date: '2026-03-15',
    description: '',
    categoryId: 'cat.food',
    paymentMethodId: 'pay.cash',
    paidBy: 'a',
    amount: 300,
    currency: 'TWD',
    exchangeRate: 1,
    split: { mode: 'even', participants: ['a', 'b', 'c'] },
    attachments: [],
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-03-15T00:00:00Z',
    ...over,
  }
}

function transfer(over: Partial<Transfer>): Transfer {
  return {
    id: 'tr',
    tripId: 't1',
    date: '2026-03-16',
    from: 'b',
    to: 'a',
    amount: 100,
    currency: 'TWD',
    exchangeRate: 1,
    kind: 'settlement',
    note: '',
    createdAt: '2026-03-16T00:00:00Z',
    updatedAt: '2026-03-16T00:00:00Z',
    ...over,
  }
}

describe('netBalances', () => {
  it('computes paid, owed and net for each member', () => {
    const balances = netBalances(trip, [expense({ paidBy: 'a', amount: 300 })], [])
    expect(balances).toEqual([
      { memberId: 'a', paidMinor: 300, owedMinor: 100, netMinor: 200 },
      { memberId: 'b', paidMinor: 0, owedMinor: 100, netMinor: -100 },
      { memberId: 'c', paidMinor: 0, owedMinor: 100, netMinor: -100 },
    ])
  })

  it('always sums net to exactly zero', () => {
    const expenses = [
      expense({ id: 'e1', paidBy: 'a', amount: 799 }),
      expense({ id: 'e2', paidBy: 'b', amount: 101, split: { mode: 'even', participants: ['a', 'c'] } }),
    ]
    const balances = netBalances(trip, expenses, [])
    expect(balances.reduce((acc, b) => acc + b.netMinor, 0)).toBe(0)
  })

  it('treats a transfer as money moving without changing spending', () => {
    const balances = netBalances(trip, [expense({ paidBy: 'a', amount: 300 })], [transfer({ from: 'b', to: 'a', amount: 100 })])
    const byId = Object.fromEntries(balances.map((b) => [b.memberId, b]))
    // b 已還清，a 只剩 c 欠的 100
    expect(byId.b!.netMinor).toBe(0)
    expect(byId.a!.netMinor).toBe(100)
    // 轉帳不改變支出總額
    expect(byId.a!.owedMinor).toBe(100)
  })

  it('keeps net summing to zero after transfers', () => {
    const balances = netBalances(
      trip,
      [expense({ paidBy: 'a', amount: 300 })],
      [transfer({ from: 'c', to: 'a', amount: 37 })],
    )
    expect(balances.reduce((acc, b) => acc + b.netMinor, 0)).toBe(0)
  })

  it('converts foreign-currency transfers using their own stored rate', () => {
    const balances = netBalances(trip, [], [transfer({ from: 'a', to: 'c', amount: 10000, currency: 'JPY', exchangeRate: 0.21, kind: 'loan' })])
    const byId = Object.fromEntries(balances.map((b) => [b.memberId, b]))
    expect(byId.a!.netMinor).toBe(2100)
    expect(byId.c!.netMinor).toBe(-2100)
  })

  it('ignores soft-deleted expenses and transfers', () => {
    const balances = netBalances(
      trip,
      [expense({ deletedAt: '2026-03-16T00:00:00Z' })],
      [transfer({ deletedAt: '2026-03-17T00:00:00Z' })],
    )
    expect(balances.every((b) => b.paidMinor === 0 && b.owedMinor === 0 && b.netMinor === 0)).toBe(true)
  })

  it('returns a row for every member, in trip member order', () => {
    const balances = netBalances(trip, [], [])
    expect(balances.map((b) => b.memberId)).toEqual(['a', 'b', 'c'])
  })
})

const bal = (memberId: string, netMinor: number): Balance => ({
  memberId,
  paidMinor: 0,
  owedMinor: 0,
  netMinor,
})

describe('minimalTransfers', () => {
  it('settles a simple two-person debt with one transfer', () => {
    expect(minimalTransfers([bal('a', 100), bal('b', -100)])).toEqual([
      { from: 'b', to: 'a', amountMinor: 100 },
    ])
  })

  it('pairs the largest creditor with the largest debtor first', () => {
    const result = minimalTransfers([bal('a', 8350), bal('b', -4050), bal('c', -4300)])
    expect(result).toEqual([
      { from: 'c', to: 'a', amountMinor: 4300 },
      { from: 'b', to: 'a', amountMinor: 4050 },
    ])
  })

  it('never needs more than n-1 transfers', () => {
    const balances = [bal('a', 300), bal('b', 100), bal('c', -150), bal('d', -250)]
    expect(minimalTransfers(balances).length).toBeLessThanOrEqual(balances.length - 1)
  })

  it('produces transfers that zero out every balance', () => {
    const balances = [bal('a', 300), bal('b', 100), bal('c', -150), bal('d', -250)]
    const net: Record<string, number> = Object.fromEntries(balances.map((b) => [b.memberId, b.netMinor]))
    for (const t of minimalTransfers(balances)) {
      net[t.from] = (net[t.from] ?? 0) + t.amountMinor
      net[t.to] = (net[t.to] ?? 0) - t.amountMinor
    }
    expect(Object.values(net).every((v) => v === 0)).toBe(true)
  })

  it('returns nothing when everyone is settled', () => {
    expect(minimalTransfers([bal('a', 0), bal('b', 0)])).toEqual([])
  })

  it('returns nothing for an empty balance list', () => {
    expect(minimalTransfers([])).toEqual([])
  })

  it('is deterministic when amounts tie', () => {
    const balances = [bal('a', 100), bal('b', 100), bal('c', -100), bal('d', -100)]
    expect(minimalTransfers(balances)).toEqual(minimalTransfers(balances))
  })
})
