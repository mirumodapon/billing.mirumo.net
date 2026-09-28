import { describe, expect, it } from 'vitest'
import { countsInTotals, isLive } from './records'

describe('countsInTotals (task#96)', () => {
  it('counts a live, finished record', () => expect(countsInTotals({})).toBe(true))
  it('leaves out a deleted record', () => expect(countsInTotals({ deletedAt: '2026-03-15T00:00:00.000Z' })).toBe(false))
  it('leaves out a draft', () => expect(countsInTotals({ draft: true })).toBe(false))
  it('counts a record explicitly marked not a draft', () => expect(countsInTotals({ draft: false })).toBe(true))
})

describe('stored-value payments (task#115, task#137)', () => {
  // task#137：儲值只是把錢放進卡裡，用卡付的才是花費
  it('leaves out a top-up, which only moves money onto a card', () => expect(countsInTotals({ topUpFor: 'suica' })).toBe(false))
  it('counts a payment drawn from a stored-value balance, which is the real expense', () => expect(countsInTotals({ fromBalance: true })).toBe(true))
})

describe('isLive (task#115)', () => {
  // 餘額要算進儲值：它不算合計，但確實加了餘額
  it('keeps live, finished records, top-ups included', () => {
    expect(isLive({ topUpFor: 'suica' })).toBe(true)
    expect(isLive({})).toBe(true)
  })
  it('leaves out deleted records and drafts', () => {
    expect(isLive({ deletedAt: '2026-03-15T00:00:00.000Z' })).toBe(false)
    expect(isLive({ draft: true })).toBe(false)
  })
})
