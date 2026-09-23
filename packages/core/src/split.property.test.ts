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

  /**
   * 成員從旅程移除後，既有支出的分攤裡仍留著該成員的 id，但他已不在 memberOrder 中。
   * 這條驗證那種情況下 reconcile 依然守住契約——加總精確、成員集合不變、
   * 而且結果可重現（缺席的 id 穩定排在最後，餘數不會換人吸收）。
   */
  it('holds when shares contain ids missing from memberOrder', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 2, maxLength: 8 }),
        fc.integer({ min: 1, max: 7 }),
        // 差額必須直接生成在「小於名單人數」的範圍。從一個 ±10,000,000 的
        // target 反推，命中這個區間的機率約 4e-7，守衛等於永遠不會成立。
        fc.integer({ min: 1, max: 8 }),
        (ids, dropCount, delta) => {
          const shares = Object.fromEntries(ids.map((id, i) => [id, i * 10]))
          // 只有前面一部分成員留在 memberOrder 裡，其餘是「已移除的成員」
          const order = ids.slice(0, Math.max(1, ids.length - (dropCount % ids.length)))
          const absent = ids.filter((id) => !order.includes(id))
          const current = Object.values(shares).reduce((x, y) => x + y, 0)
          const target = current + delta

          const result = reconcile(shares, target, order)
          expect(Object.values(result).reduce((x, y) => x + y, 0)).toBe(target)
          expect(Object.keys(result).sort()).toEqual(ids.slice().sort())

          // 名單內的成員優先吸收餘數：差額不超過名單人數時，已移除的成員一分不動。
          // 這是「缺席 id 穩定排在最後」的實際契約——少了它，成員一被移除，
          // 同一筆帳重算就會換人吸收零頭。
          if (delta <= order.length) {
            for (const id of absent) {
              expect(result[id]).toBe(shares[id])
            }
          }
        },
      ),
      { numRuns: 2000 },
    )
  })
})
