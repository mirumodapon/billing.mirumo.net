import { describe, expect, it } from 'vitest'
import { reconcile, sortByMemberOrder, splitEven } from './split'

const ORDER = ['a', 'b', 'c', 'd']

const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0)

describe('sortByMemberOrder', () => {
  it('orders ids by their position in memberOrder', () => {
    expect(sortByMemberOrder(['c', 'a', 'b'], ORDER)).toEqual(['a', 'b', 'c'])
  })

  it('puts ids missing from memberOrder at the end, stably', () => {
    expect(sortByMemberOrder(['z', 'b', 'y'], ORDER)).toEqual(['b', 'z', 'y'])
  })
})

describe('splitEven', () => {
  it('divides evenly when there is no remainder', () => {
    expect(splitEven(800, ['a', 'b', 'c', 'd'])).toEqual({ a: 200, b: 200, c: 200, d: 200 })
  })

  it('gives the remainder to the earliest members in order', () => {
    // 3800 / 4 = 950 餘 0... 用 799 / 4 = 199 餘 3
    expect(splitEven(799, ['a', 'b', 'c', 'd'])).toEqual({ a: 200, b: 200, c: 200, d: 199 })
  })

  it('always sums to the total', () => {
    for (const total of [1, 7, 99, 100, 3800, 12345]) {
      for (const k of [1, 2, 3, 4, 5, 7]) {
        const participants = ORDER.concat(['e', 'f', 'g']).slice(0, k)
        expect(sum(splitEven(total, participants))).toBe(total)
      }
    }
  })

  it('handles a single participant', () => {
    expect(splitEven(3800, ['a'])).toEqual({ a: 3800 })
  })

  it('handles zero total', () => {
    expect(splitEven(0, ['a', 'b'])).toEqual({ a: 0, b: 0 })
  })

  it('returns an empty record for no participants', () => {
    expect(splitEven(100, [])).toEqual({})
  })

  it('distributes negative totals without losing the remainder', () => {
    expect(sum(splitEven(-799, ['a', 'b', 'c', 'd']))).toBe(-799)
  })
})

describe('reconcile', () => {
  it('leaves shares untouched when they already sum to the target', () => {
    const shares = { a: 200, b: 200 }
    expect(reconcile(shares, 400, ORDER)).toEqual({ a: 200, b: 200 })
  })

  it('adds a positive difference one minor unit at a time, in member order', () => {
    expect(reconcile({ a: 100, b: 100 }, 203, ORDER)).toEqual({ a: 102, b: 101 })
  })

  it('removes a negative difference the same way', () => {
    expect(reconcile({ a: 100, b: 100 }, 197, ORDER)).toEqual({ a: 98, b: 99 })
  })

  it('does not mutate its input', () => {
    const shares = { a: 100, b: 100 }
    reconcile(shares, 205, ORDER)
    expect(shares).toEqual({ a: 100, b: 100 })
  })

  it('returns an empty record when there are no shares', () => {
    expect(reconcile({}, 500, ORDER)).toEqual({})
  })
})
