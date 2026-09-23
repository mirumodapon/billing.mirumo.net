import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { reconcile, splitEven } from './split'

const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0)

/** 1–8 個不重複的成員 id */
const participants = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 8 })

/** 記帳規模的金額，含負數（退款、折扣） */
const totalMinor = fc.integer({ min: -10_000_000, max: 10_000_000 })

describe('splitEven invariants', () => {
  it('always sums to the total', () => {
    fc.assert(
      fc.property(totalMinor, participants, (total, members) => {
        expect(sum(splitEven(total, members))).toBe(total)
      }),
      { numRuns: 2000 },
    )
  })

  it('never lets two shares differ by more than one minor unit', () => {
    fc.assert(
      fc.property(totalMinor, participants, (total, members) => {
        const values = Object.values(splitEven(total, members))
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
      }),
      { numRuns: 2000 },
    )
  })

  it('is deterministic for the same input', () => {
    fc.assert(
      fc.property(totalMinor, participants, (total, members) => {
        expect(splitEven(total, members)).toEqual(splitEven(total, members))
      }),
    )
  })
})

describe('reconcile invariants', () => {
  it('always lands exactly on the target', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 4 }), fc.integer({ min: -100_000, max: 100_000 }), {
          minKeys: 1,
          maxKeys: 8,
        }),
        totalMinor,
        (shares, target) => {
          const order = Object.keys(shares)
          expect(sum(reconcile(shares, target, order))).toBe(target)
        },
      ),
      { numRuns: 2000 },
    )
  })

  it('preserves the set of member ids', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 4 }), fc.integer({ min: 0, max: 1000 }), {
          minKeys: 1,
          maxKeys: 8,
        }),
        totalMinor,
        (shares, target) => {
          const order = Object.keys(shares)
          expect(Object.keys(reconcile(shares, target, order)).sort()).toEqual(order.sort())
        },
      ),
    )
  })
})
