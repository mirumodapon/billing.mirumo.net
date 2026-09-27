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

  it('keeps floating point noise out of the ticks', () => {
    // 0.1 × 3 在浮點數下是 0.30000000000000004，刻度要顯示成 0.3
    expect(niceScale(0.3)).toEqual({ max: 0.3, ticks: [0, 0.1, 0.2, 0.3] })
  })

  /*
   * 除法結果的雜訊落在整數「上方」時，直接 ceil 會多出一整格空刻度。
   * 注意 0.3 / 0.1 = 2.9999999999999996 是落在下方，ceil 本來就對——原本的
   * 測試拿它當例子，所以拿掉修正照樣全綠。窮舉 26 萬個值找到的真實例子
   * 在這個量級：步距本身就帶雜訊（0.0000049999999999999996），
   * 1e-5 / 步距 = 2.0000000000000004。
   */
  it('does not add a spurious step when division noise lands above an integer', () => {
    expect(niceScale(0.00001)).toEqual({ max: 0.00001, ticks: [0, 0.000005, 0.00001] })
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
