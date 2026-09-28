import { describe, expect, it } from 'vitest'
import { countsInTotals, isLive } from './records'

describe('countsInTotals (task#96)', () => {
  it('counts a live, finished record', () => expect(countsInTotals({})).toBe(true))
  it('leaves out a deleted record', () => expect(countsInTotals({ deletedAt: '2026-03-15T00:00:00.000Z' })).toBe(false))
  it('leaves out a draft', () => expect(countsInTotals({ draft: true })).toBe(false))
  it('counts a record explicitly marked not a draft', () => expect(countsInTotals({ draft: false })).toBe(true))
})

describe('stored-value payments (task#115)', () => {
  // 儲值那一筆才是支出；之後用卡付的只是從餘額扣，再算一次就重複了
  it('leaves out a payment drawn from a stored-value balance', () => expect(countsInTotals({ fromBalance: true })).toBe(false))
  it('still counts a top-up, which is the real expense', () => expect(countsInTotals({ topUpFor: 'suica' })).toBe(true))
})

describe('isLive (task#115)', () => {
  // 餘額要算進用卡付的：它們不算合計，但確實扣了餘額
  it('keeps live, finished records, balance payments included', () => {
    expect(isLive({ fromBalance: true })).toBe(true)
    expect(isLive({})).toBe(true)
  })
  it('leaves out deleted records and drafts', () => {
    expect(isLive({ deletedAt: '2026-03-15T00:00:00.000Z' })).toBe(false)
    expect(isLive({ draft: true })).toBe(false)
  })
})
