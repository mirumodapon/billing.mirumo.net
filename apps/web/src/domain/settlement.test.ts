import type { Trip } from '@billing/core'
import { describe, expect, it } from 'vitest'
import { makeExpense, makeTransfer, makeTrip } from '../data/testing/fixtures'
import { setLocale, t } from '../i18n'
import { formatMoney } from '../i18n/format'
import { settlementView, shareText, signedMoney } from './settlement'

// 三人、本位幣 TWD（零小數），方便手算
const trip: Trip = makeTrip({ baseCurrency: 'TWD', name: '東京五日' })
const expenses = [
  // 阿明付 3,000，三人均分 → 每人 1,000
  makeExpense({ id: 'e1', paidBy: 'a', amount: 3000, currency: 'TWD', exchangeRate: 1, split: { mode: 'even', participants: ['a', 'b', 'c'] } }),
  // 小美付 1,200，只算小美與大熊 → 每人 600
  makeExpense({ id: 'e2', paidBy: 'b', amount: 1200, currency: 'TWD', exchangeRate: 1, split: { mode: 'even', participants: ['b', 'c'] } }),
]
// 大熊向阿明借 500：大熊給錢（+500），阿明收錢（−500）……方向見規格 3.4
const loan = makeTransfer({ id: 'x1', from: 'c', to: 'a', amount: 500, currency: 'TWD', exchangeRate: 1, kind: 'loan' })

const net = (view: ReturnType<typeof settlementView>) => Object.fromEntries(view.balances.map((b) => [b.memberId, b.netMinor]))

describe('settlementView: the hand-worked ledger (spec §10 stage 7 acceptance)', () => {
  /*
   * 手算：
   *   paid  阿明 3,000  小美 1,200  大熊 0
   *   owed  阿明 1,000  小美 1,600  大熊 1,600
   *   轉帳  大熊 → 阿明 500：大熊 +500、阿明 −500
   *   net   阿明 +1,500  小美 −400  大熊 −1,100   Σ = 0
   */
  const view = settlementView(trip, expenses, [loan])

  it('matches the hand-worked balances', () => {
    expect(net(view)).toEqual({ a: 150000, b: -40000, c: -110000 })
  })

  it('adds up to exactly zero', () => {
    expect(view.totalNet).toBe(0)
  })

  it('labels who is owed, who owes and who is square', () => {
    expect(view.balances.map((b) => [b.name, b.status])).toEqual([
      ['阿明', 'receive'],
      ['小美', 'pay'],
      ['大熊', 'pay'],
    ])
  })

  // 規格 3.4：貪婪法，不超過 n−1 筆
  it('suggests the fewest transfers that settle everything', () => {
    expect(view.pending.map((p) => [p.fromName, p.toName, p.amountMinor])).toEqual([
      ['大熊', '阿明', 110000],
      ['小美', '阿明', 40000],
    ])
  })
})

describe('settlementView: settling up', () => {
  it('is fully settled once the suggested transfers are recorded', () => {
    const settle = [
      makeTransfer({ id: 's1', from: 'c', to: 'a', amount: 1100, exchangeRate: 1, kind: 'settlement' }),
      makeTransfer({ id: 's2', from: 'b', to: 'a', amount: 400, exchangeRate: 1, kind: 'settlement' }),
    ]
    const view = settlementView(trip, expenses, [loan, ...settle])
    expect(view.pending).toEqual([])
    expect(view.balances.every((b) => b.status === 'settled')).toBe(true)
  })

  // 規格 4.6：實際還錢時湊整（欠 400 給 500），差額自動回到淨額
  it('carries a rounded-up payment back into the balances', () => {
    const rounded = makeTransfer({ id: 's2', from: 'b', to: 'a', amount: 500, exchangeRate: 1, kind: 'settlement' })
    const view = settlementView(trip, expenses, [loan, rounded])
    expect(net(view)).toEqual({ a: 100000, b: 10000, c: -110000 })
    expect(view.pending.map((p) => [p.from, p.to, p.amountMinor])).toEqual([
      ['c', 'a', 100000],
      ['c', 'b', 10000],
    ])
  })

  it('converts foreign-currency transfers at their own rate', () => {
    const yen = makeTransfer({ id: 's3', from: 'b', to: 'a', amount: 2000, currency: 'JPY', exchangeRate: 0.2 })
    expect(net(settlementView(trip, expenses, [loan, yen])).b).toBe(-400 + 400)
  })

  it('ignores deleted records', () => {
    const view = settlementView(trip, [...expenses, makeExpense({ id: 'gone', paidBy: 'c', amount: 9000, exchangeRate: 1, deletedAt: 'x' })], [
      loan,
      makeTransfer({ id: 'gone', from: 'a', to: 'c', amount: 9000, exchangeRate: 1, deletedAt: 'x' }),
    ])
    expect(net(view)).toEqual({ a: 150000, b: -40000, c: -110000 })
  })
})

describe('shareText (Plan 8 S6)', () => {
  const money = formatMoney

  it('lists each balance and what is left to settle', () => {
    setLocale('zh-TW')
    const view = settlementView(trip, expenses, [loan])
    expect(shareText(trip, view, t, money)).toBe(
      [
        '東京五日 結算',
        '',
        `阿明 +${money(150000, 'TWD')} 待收`,
        `小美 ${money(-40000, 'TWD')} 待付`,
        `大熊 ${money(-110000, 'TWD')} 待付`,
        '',
        '尚待結清',
        `大熊 付給 阿明 ${money(110000, 'TWD')}`,
        `小美 付給 阿明 ${money(40000, 'TWD')}`,
      ].join('\n'),
    )
  })

  it('says everything is settled, in English too', () => {
    setLocale('en-US')
    const done = settlementView(makeTrip({ name: 'Tokyo' }), [], [])
    expect(shareText(makeTrip({ name: 'Tokyo' }), done, t, money)).toBe(
      ['Tokyo settlement', '', `阿明 ${money(0, 'TWD')} Settled`, `小美 ${money(0, 'TWD')} Settled`, `大熊 ${money(0, 'TWD')} Settled`, '', 'All settled'].join('\n'),
    )
  })

  it('signs positive balances and leaves zero unsigned', () => {
    expect(signedMoney(10000, 'TWD', formatMoney)).toBe(`+${formatMoney(10000, 'TWD')}`)
    expect(signedMoney(0, 'TWD', formatMoney)).toBe(formatMoney(0, 'TWD'))
  })
})
