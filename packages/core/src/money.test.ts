import { describe, expect, it } from 'vitest'
import { convertToBaseMinor, decimalsOf, fromMinor, toMinor } from './money'

describe('decimalsOf', () => {
  it('treats TWD as zero-decimal by design', () => {
    expect(decimalsOf('TWD')).toBe(0)
  })

  it('returns 0 for other zero-decimal currencies', () => {
    expect(decimalsOf('JPY')).toBe(0)
    expect(decimalsOf('KRW')).toBe(0)
    expect(decimalsOf('VND')).toBe(0)
  })

  it('returns 2 for two-decimal currencies', () => {
    expect(decimalsOf('USD')).toBe(2)
    expect(decimalsOf('EUR')).toBe(2)
  })

  it('falls back to 2 for unknown currencies', () => {
    expect(decimalsOf('XXX')).toBe(2)
  })
})

describe('toMinor', () => {
  it('scales by the decimal count', () => {
    expect(toMinor(12.34, 2)).toBe(1234)
    expect(toMinor(798, 0)).toBe(798)
  })

  it('rounds half up', () => {
    expect(toMinor(0.125, 2)).toBe(13)
    expect(toMinor(1.5, 0)).toBe(2)
  })

  // 以下是二進位浮點的經典陷阱值。直接 Math.round(v * 100) 會全部算錯。
  it('survives binary floating point traps', () => {
    expect(toMinor(0.1 + 0.2, 2)).toBe(30)
    expect(toMinor(1.005, 2)).toBe(101)
    expect(toMinor(2.675, 2)).toBe(268)
    expect(toMinor(8.615, 2)).toBe(862)
  })

  // toPrecision(12) 只該抹掉表示誤差，不該把真正在中點以下的值往上推
  it('does not round up values genuinely below the midpoint', () => {
    expect(toMinor(1.0044, 2)).toBe(100)
    expect(toMinor(2.6749, 2)).toBe(267)
  })

  it('keeps large amounts exact', () => {
    // 12 位有效數字足以涵蓋記帳金額；JPY 這類零小數幣別動輒七位數
    expect(toMinor(9999999, 0)).toBe(9999999)
    expect(toMinor(1234567.89, 2)).toBe(123456789)
  })

  it('handles zero and negatives', () => {
    expect(toMinor(0, 2)).toBe(0)
    expect(toMinor(-12.34, 2)).toBe(-1234)
  })
})

describe('fromMinor', () => {
  it('is the inverse of toMinor for representable values', () => {
    expect(fromMinor(1234, 2)).toBe(12.34)
    expect(fromMinor(798, 0)).toBe(798)
  })
})

describe('convertToBaseMinor', () => {
  it('converts foreign amount to base currency minor units', () => {
    // ¥3,800 × 0.21 = NT$798，TWD 為 0 位
    expect(convertToBaseMinor(3800, 0.21, 'TWD')).toBe(798)
  })

  it('rounds to the base currency precision', () => {
    // 100 × 1.2345 = 123.45 → USD 兩位
    expect(convertToBaseMinor(100, 1.2345, 'USD')).toBe(12345)
  })

  it('returns the same amount when the rate is 1', () => {
    expect(convertToBaseMinor(500, 1, 'TWD')).toBe(500)
  })

  // 沒有這道守衛，NaN 會一路傳到最糟的終點：每個人淨額都是 NaN，而
  // NaN > 0 與 NaN < 0 同時為 false，最少轉帳回傳空陣列，結算畫面就在
  // 資料全壞的情況下顯示「大家都結清了」。
  it('refuses non-finite input rather than letting NaN propagate', () => {
    expect(() => convertToBaseMinor(Number.NaN, 0.21, 'TWD')).toThrow(/finite/)
    expect(() => convertToBaseMinor(500, Number.NaN, 'TWD')).toThrow(/finite/)
    expect(() => convertToBaseMinor(500, Number.POSITIVE_INFINITY, 'TWD')).toThrow(/finite/)
    expect(() => convertToBaseMinor(undefined as unknown as number, 1, 'TWD')).toThrow(/finite/)
  })
})
