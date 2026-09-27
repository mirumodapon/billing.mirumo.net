import type { Trip } from '@billing/core'
import { describe, expect, it } from 'vitest'
import { makeTransfer, makeTrip } from '../data/testing/fixtures'
import {
  isTransferDraft,
  newTransferDraft,
  parsePrefill,
  toTransfer,
  transferDraftFrom,
  transferProblems,
  withAutoTransferRate,
  withManualTransferRate,
  type TransferDraft,
} from './transferDraft'

const trip: Trip = makeTrip({ startDate: '2026-03-14', endDate: '2026-03-18', rates: { default: { JPY: 0.21 }, byMethod: { 'JPY|pay.cash': 0.3 } } })
const ctx = { trip, today: '2026-03-15' }
const filled = (overrides: Partial<TransferDraft> = {}): TransferDraft => ({ ...newTransferDraft(ctx), amount: 500, ...overrides })

describe('newTransferDraft', () => {
  it('starts as a loan from me to the next person, in the home currency, today', () => {
    expect(newTransferDraft(ctx)).toMatchObject({
      from: 'a',
      to: 'b',
      currency: 'TWD',
      exchangeRate: 1,
      rateTouched: false,
      kind: 'loan',
      date: '2026-03-15',
      amount: undefined,
      note: '',
    })
  })

  it('dates it on the trip’s first day when today is outside the trip', () => {
    expect(newTransferDraft({ trip, today: '2026-04-01' }).date).toBe('2026-03-14')
  })

  // Plan 8 S1：「已結清」帶來的建議是本位幣算的
  it('takes a settlement’s people, amount and kind, always in the home currency', () => {
    expect(newTransferDraft(ctx, { from: 'c', to: 'a', amount: 1100, kind: 'settlement' })).toMatchObject({
      from: 'c',
      to: 'a',
      amount: 1100,
      kind: 'settlement',
      currency: 'TWD',
      exchangeRate: 1,
    })
  })
})

describe('transfer rate (Plan 8 S2)', () => {
  // 轉帳沒有付款方式：只看幣別的預設匯率，不會誤用某個付款方式的匯率
  it('uses the currency’s default rate', () => {
    expect(withAutoTransferRate({ ...filled(), currency: 'JPY' }, trip).exchangeRate).toBe(0.21)
  })

  it('leaves it blank when the trip has no rate for the currency', () => {
    expect(withAutoTransferRate({ ...filled(), currency: 'KRW' }, trip).exchangeRate).toBeUndefined()
  })

  it('keeps a rate set by hand', () => {
    const d = withManualTransferRate({ ...filled(), currency: 'JPY' }, 0.2)
    expect(withAutoTransferRate({ ...d, currency: 'USD' }, trip).exchangeRate).toBe(0.2)
  })

  it('treats an existing transfer’s rate as fixed', () => {
    const d = transferDraftFrom(makeTransfer({ currency: 'JPY', exchangeRate: 0.19 }))
    expect(withAutoTransferRate(d, trip).exchangeRate).toBe(0.19)
  })
})

describe('transferProblems (Plan 8 S4)', () => {
  it('accepts a complete transfer', () => expect(transferProblems(filled())).toEqual([]))
  it('needs an amount above zero', () => {
    expect(transferProblems(filled({ amount: undefined }))).toContain('amountRequired')
    expect(transferProblems(filled({ amount: 0 }))).toContain('amountRequired')
  })
  it('needs a rate', () => expect(transferProblems(filled({ currency: 'KRW', exchangeRate: undefined }))).toContain('rateRequired'))
  it('needs two different people', () => expect(transferProblems(filled({ to: 'a' }))).toContain('sameMember'))
})

describe('toTransfer', () => {
  it('fixes the rate and trims the note, leaving timestamps to the repository', () => {
    const x = toTransfer(filled({ currency: 'JPY', exchangeRate: 0.213, note: ' 現金不夠 ' }), 't1')
    expect(x).toMatchObject({ tripId: 't1', from: 'a', to: 'b', amount: 500, currency: 'JPY', exchangeRate: 0.213, note: '現金不夠', createdAt: '', updatedAt: '' })
    expect(x.id).toBeTruthy()
  })

  it('round-trips an existing transfer', () => {
    const original = makeTransfer({ note: '還錢', kind: 'settlement' })
    const again = toTransfer(transferDraftFrom(original), original.tripId)
    expect({ ...again, createdAt: original.createdAt, updatedAt: original.updatedAt }).toEqual(original)
  })
})

describe('isTransferDraft', () => {
  it('accepts drafts the form produces', () => {
    expect(isTransferDraft(newTransferDraft(ctx))).toBe(true)
    expect(isTransferDraft(transferDraftFrom(makeTransfer()))).toBe(true)
  })

  it.each([null, {}, { ...newTransferDraft(ctx), kind: 'gift' }, { ...newTransferDraft(ctx), amount: 'x' }, { ...newTransferDraft(ctx), from: 1 }])(
    'rejects %j',
    (value) => expect(isTransferDraft(value)).toBe(false),
  )
})

describe('parsePrefill (Plan 8 S3)', () => {
  it('reads people, amount and kind from the address', () => {
    expect(parsePrefill(new URLSearchParams('from=c&to=a&amount=1100&kind=settlement'), trip)).toEqual({ from: 'c', to: 'a', amount: 1100, kind: 'settlement' })
  })

  // 網址是外部輸入：不認得的一律丟掉，不能讓表單拿到不存在的成員
  it('drops anything it does not recognise', () => {
    expect(parsePrefill(new URLSearchParams('from=zz&to=a&amount=abc&kind=gift'), trip)).toEqual({ to: 'a' })
    expect(parsePrefill(new URLSearchParams('amount=-5'), trip)).toEqual({})
    expect(parsePrefill(new URLSearchParams(''), trip)).toEqual({})
  })
})
