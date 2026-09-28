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
      { memberId: 'a', paidMinor: 30000, owedMinor: 10000, netMinor: 20000 },
      { memberId: 'b', paidMinor: 0, owedMinor: 10000, netMinor: -10000 },
      { memberId: 'c', paidMinor: 0, owedMinor: 10000, netMinor: -10000 },
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

  // 其他案例每個付款人都只付一次，所以「累加」和「覆寫」結果相同——
  // 而 Σ net === 0 正是建立在這個累加上。這兩條讓同一個人出現兩次。
  it('accumulates across multiple expenses paid by the same member', () => {
    const balances = netBalances(
      trip,
      [
        expense({ id: 'e1', paidBy: 'a', amount: 300 }),
        expense({ id: 'e2', paidBy: 'a', amount: 600 }),
      ],
      [],
    )
    // a 墊了 900，三人各該負擔 300
    expect(balances).toEqual([
      { memberId: 'a', paidMinor: 90000, owedMinor: 30000, netMinor: 60000 },
      { memberId: 'b', paidMinor: 0, owedMinor: 30000, netMinor: -30000 },
      { memberId: 'c', paidMinor: 0, owedMinor: 30000, netMinor: -30000 },
    ])
  })

  it('accumulates across multiple transfers touching the same member', () => {
    const balances = netBalances(
      trip,
      [],
      [
        transfer({ id: 't1', from: 'b', to: 'a', amount: 100 }),
        transfer({ id: 't2', from: 'b', to: 'a', amount: 50 }),
      ],
    )
    // b 總共給了 150，不是最後一筆的 50
    expect(balances).toEqual([
      { memberId: 'a', paidMinor: 0, owedMinor: 0, netMinor: -15000 },
      { memberId: 'b', paidMinor: 0, owedMinor: 0, netMinor: 15000 },
      { memberId: 'c', paidMinor: 0, owedMinor: 0, netMinor: 0 },
    ])
  })

  it('treats a transfer as money moving without changing spending', () => {
    const balances = netBalances(trip, [expense({ paidBy: 'a', amount: 300 })], [transfer({ from: 'b', to: 'a', amount: 100 })])
    const byId = Object.fromEntries(balances.map((b) => [b.memberId, b]))
    // b 已還清，a 只剩 c 欠的 100
    expect(byId.b!.netMinor).toBe(0)
    expect(byId.a!.netMinor).toBe(10000)
    // 轉帳不改變支出總額
    expect(byId.a!.owedMinor).toBe(10000)
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
    expect(byId.a!.netMinor).toBe(210000)
    expect(byId.c!.netMinor).toBe(-210000)
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

  // 上面那組只有一位債權人，所以它驗不到債權人那側的排序；
  // 其他案例的債權人又剛好已是降冪。這組刻意讓 a 少於 b。
  it('pairs the largest creditor first even when the input lists a smaller one earlier', () => {
    const result = minimalTransfers([bal('a', 100), bal('b', 300), bal('c', -400)])
    // 先清掉 b 的 300，再清 a 的 100；不排序的話會反過來
    expect(result).toEqual([
      { from: 'c', to: 'b', amountMinor: 300 },
      { from: 'c', to: 'a', amountMinor: 100 },
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

// task#96：草稿看得到、改得了，但在完成之前不影響淨額
describe('netBalances: drafts', () => {
  it('leaves draft expenses and transfers out of the balances', () => {
    const finished = [expense({ id: 'e1', paidBy: 'a', amount: 300 })]
    const withDrafts = netBalances(
      trip,
      [...finished, expense({ id: 'e2', paidBy: 'b', amount: 900, draft: true })],
      [transfer({ id: 'x1', from: 'c', to: 'a', amount: 100, draft: true })],
    )
    expect(withDrafts).toEqual(netBalances(trip, finished, []))
  })
})
