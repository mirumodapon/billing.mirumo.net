import { describe, expect, it } from 'vitest'
import { countsInTotals } from './records'

describe('countsInTotals (task#96)', () => {
  it('counts a live, finished record', () => expect(countsInTotals({})).toBe(true))
  it('leaves out a deleted record', () => expect(countsInTotals({ deletedAt: '2026-03-15T00:00:00.000Z' })).toBe(false))
  it('leaves out a draft', () => expect(countsInTotals({ draft: true })).toBe(false))
  it('counts a record explicitly marked not a draft', () => expect(countsInTotals({ draft: false })).toBe(true))
})
