import { describe, expect, it } from 'vitest'
import { barPath, niceScale } from './barMath'

describe('niceScale', () => {
  it('rounds the top up to a clean number with clean steps', () => {
    expect(niceScale(2800)).toEqual({ max: 3000, ticks: [0, 1000, 2000, 3000] })
    expect(niceScale(1000)).toEqual({ max: 1000, ticks: [0, 500, 1000] })
  })

  // 最大值剛好落在刻度上時不能再多加一格，否則最高的柱永遠碰不到頂
  it('does not add an empty step when the max is already clean', () => {
    expect(niceScale(3000).max).toBe(3000)
  })

  // 0.3 / 0.1 在浮點數下是 2.9999999999999996，直接 ceil 會多出一格
  it('keeps floating point noise out of the ticks', () => {
    expect(niceScale(0.3)).toEqual({ max: 0.3, ticks: [0, 0.1, 0.2, 0.3] })
  })

  it('handles an all-zero day set', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0] })
  })
})

function xs(d: string): number[] {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  return nums.filter((_, i) => i % 2 === 0)
}

describe('barPath', () => {
  // 底部方角：路徑從基線上的左下角開始，最後回到基線上的右下角
  it('starts and ends square on the baseline', () => {
    const d = barPath(10, 20, 40, 100)
    expect(d.startsWith('M 10 100')).toBe(true)
    expect(d).toMatch(/L 30 100 Z$/)
  })

  it('spans exactly the requested width', () => {
    const coords = xs(barPath(10, 20, 40, 100))
    expect(Math.max(...coords) - Math.min(...coords)).toBe(20)
  })

  // 比圓角還矮的柱，圓角要縮小，否則路徑會往基線下方凸出去
  it('shrinks the corner radius on a very short bar', () => {
    const d = barPath(0, 20, 98, 100)
    const ys = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 1)
    expect(Math.max(...ys)).toBe(100)
    expect(Math.min(...ys)).toBe(98)
  })

  it('draws nothing for a zero-height bar', () => {
    expect(barPath(0, 20, 100, 100)).toBe('')
  })
})
