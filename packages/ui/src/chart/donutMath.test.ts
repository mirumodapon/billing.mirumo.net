import { describe, expect, it } from 'vitest'
import { arcPath, donutArcs, percentages } from './donutMath'

const TAU = Math.PI * 2

describe('donutArcs', () => {
  it('gives each value a share of the circle proportional to its size', () => {
    const arcs = donutArcs([{ key: 'a', value: 1 }, { key: 'b', value: 3 }], 0)
    expect(arcs[0]!.end - arcs[0]!.start).toBeCloseTo(TAU / 4)
    expect(arcs[1]!.end - arcs[1]!.start).toBeCloseTo((TAU * 3) / 4)
  })

  // 2px 的間隙靠角度留白，不靠描邊：描邊是不屬於資料的墨水
  it('leaves a gap between neighbours so they never touch', () => {
    const gap = 0.05
    const arcs = donutArcs([{ key: 'a', value: 1 }, { key: 'b', value: 1 }, { key: 'c', value: 2 }], gap)
    for (let i = 0; i < arcs.length - 1; i += 1) {
      expect(arcs[i + 1]!.start - arcs[i]!.end).toBeCloseTo(gap)
    }
    expect(arcs[0]!.start).toBeCloseTo(gap / 2)
    expect(TAU - arcs.at(-1)!.end).toBeCloseTo(gap / 2)
  })

  // 只有一塊時是完整的圓，不留缺口——缺口會讓人以為少了一類
  it('draws a single value as a full ring with no gap', () => {
    expect(donutArcs([{ key: 'a', value: 5 }], 0.05)).toEqual([{ key: 'a', start: 0, end: TAU }])
  })

  it('skips zero and negative values', () => {
    const arcs = donutArcs([{ key: 'a', value: 0 }, { key: 'b', value: 4 }, { key: 'c', value: -2 }], 0)
    expect(arcs.map((a) => a.key)).toEqual(['b'])
  })

  it('returns nothing when there is nothing to draw', () => {
    expect(donutArcs([], 0.05)).toEqual([])
    expect(donutArcs([{ key: 'a', value: 0 }], 0.05)).toEqual([])
  })
})

describe('arcPath', () => {
  it('produces a closed path with no NaN', () => {
    const d = arcPath(50, 50, 48, 34, 0, Math.PI / 2)
    expect(d).toMatch(/^M /)
    expect(d).toMatch(/Z$/)
    expect(d).not.toMatch(/NaN/)
  })

  // 超過半圈時 SVG 的 large-arc 旗標要是 1，否則會走另一條短弧
  it('sets the large-arc flag for spans over half a turn', () => {
    expect(arcPath(50, 50, 48, 34, 0, Math.PI * 1.5)).toMatch(/A 48 48 0 1 1/)
    expect(arcPath(50, 50, 48, 34, 0, Math.PI * 0.5)).toMatch(/A 48 48 0 0 1/)
  })

  // 起點與終點重合的單一弧畫不出完整的圓，必須拆成兩個半圓
  it('draws a full turn as two half arcs', () => {
    const d = arcPath(50, 50, 48, 34, 0, Math.PI * 2)
    expect(d.match(/A 48 48/g)).toHaveLength(2)
    expect(d.match(/A 34 34/g)).toHaveLength(2)
  })
})

describe('percentages', () => {
  // 各自四捨五入會得到 33 + 33 + 33 = 99
  it('always sums to exactly 100', () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33])
    expect(percentages([1, 2, 97]).reduce((a, b) => a + b, 0)).toBe(100)
    expect(percentages([333, 333, 334]).reduce((a, b) => a + b, 0)).toBe(100)
  })

  // 平手時照原本的順序給，結果才可重現
  it('breaks ties by position', () => {
    expect(percentages([1, 1, 1, 1, 1, 1])).toEqual([17, 17, 17, 17, 16, 16])
  })

  it('leaves exact shares alone', () => {
    expect(percentages([50, 50])).toEqual([50, 50])
    expect(percentages([1, 3])).toEqual([25, 75])
  })

  it('returns zeros when there is nothing to divide', () => {
    expect(percentages([0, 0])).toEqual([0, 0])
    expect(percentages([])).toEqual([])
  })

  it('treats negative values as zero', () => {
    expect(percentages([-5, 5])).toEqual([0, 100])
  })
})
