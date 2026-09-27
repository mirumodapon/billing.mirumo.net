import { describe, expect, it } from 'vitest'
import { appendKey, evaluate, formatExpression, formatResult, type CalcKey } from './calcEngine'

/** 依序按下一串鍵 */
function press(keys: CalcKey[], decimals = 2, start = ''): string {
  return keys.reduce((expr, key) => appendKey(expr, key, decimals), start)
}

describe('appendKey', () => {
  it('builds a number digit by digit', () => {
    expect(press(['1', '2', '0', '0'])).toBe('1200')
  })

  it('appends an operator after a number', () => {
    expect(press(['1', '2', '+', '3'])).toBe('12+3')
  })

  // 連按兩個運算子時以後者取代前者，而不是產生 12+× 這種算不出來的東西
  it('replaces the operator when two are pressed in a row', () => {
    expect(press(['1', '2', '+', '×'])).toBe('12×')
  })

  it('ignores an operator at the very start', () => {
    expect(press(['+', '5'])).toBe('5')
  })

  it('collapses leading zeros', () => {
    expect(press(['0', '0', '7'])).toBe('7')
    expect(press(['1', '+', '0', '5'])).toBe('1+5')
  })

  it('starts a decimal with 0. when the number is empty', () => {
    expect(press(['.', '5'])).toBe('0.5')
    expect(press(['1', '+', '.', '5'])).toBe('1+0.5')
  })

  it('allows only one decimal point per number', () => {
    expect(press(['1', '.', '5', '.', '2'])).toBe('1.52')
  })

  // 規格 5.3：JPY/KRW/TWD 這類零小數幣別，小數點從源頭停用
  it('refuses a decimal point for a zero-decimal currency', () => {
    expect(press(['1', '.', '5'], 0)).toBe('15')
  })

  it('refuses more fraction digits than the currency has', () => {
    expect(press(['1', '.', '2', '3', '4'], 2)).toBe('1.23')
  })

  it('caps the integer part at twelve digits', () => {
    const thirteen: CalcKey[] = Array.from({ length: 13 }, () => '9')
    expect(press(thirteen)).toBe('9'.repeat(12))
  })

  // 規格 5.3：000 鍵省下日圓、韓元動輒四五位數的點擊
  it('appends three zeros with the 000 key', () => {
    expect(press(['1', '000'])).toBe('1000')
  })

  // 空的或只有 0 時按 000 不能產生 000 這種前導零
  it('ignores 000 on an empty or zero number', () => {
    expect(press(['000'])).toBe('')
    expect(press(['0', '000'])).toBe('0')
    expect(press(['1', '+', '000'])).toBe('1+')
  })

  // 000 也要遵守長度上限，不能一次衝破十二位
  it('respects the digit cap with 000', () => {
    const eleven: CalcKey[] = Array.from({ length: 11 }, () => '9')
    expect(press([...eleven, '000'])).toBe('9'.repeat(11) + '0')
  })

  it('drops a dangling decimal point before an operator', () => {
    expect(press(['1', '2', '.', '+'])).toBe('12+')
  })

  it('removes the last character with back', () => {
    expect(press(['1', '2', '+', 'back'])).toBe('12')
  })

  it('clears everything', () => {
    expect(press(['1', '2', '+', '3', 'clear'])).toBe('')
  })
})

describe('evaluate', () => {
  it('adds a column of receipt lines', () => {
    expect(evaluate('1200+800+450', 0)).toEqual({ ok: true, value: 2450 })
  })

  it('gives multiplication and division precedence', () => {
    expect(evaluate('1200+800×2', 0)).toEqual({ ok: true, value: 2800 })
    expect(evaluate('900÷3+1', 0)).toEqual({ ok: true, value: 301 })
  })

  it('evaluates left to right at equal precedence', () => {
    expect(evaluate('10−4−3', 0)).toEqual({ ok: true, value: 3 })
    expect(evaluate('100÷10÷2', 0)).toEqual({ ok: true, value: 5 })
  })

  // 規格 5.3：式尾掛著運算子時直接丟棄，不報錯
  it('drops a trailing operator', () => {
    expect(evaluate('1200+', 0)).toEqual({ ok: true, value: 1200 })
  })

  it('rounds to the currency decimals', () => {
    expect(evaluate('100÷3', 2)).toEqual({ ok: true, value: 33.33 })
    expect(evaluate('100÷3', 0)).toEqual({ ok: true, value: 33 })
  })

  // 0.1+0.2 在浮點數下是 0.30000000000000004；四捨五入必須先把雜訊壓掉
  it('does not leak floating point noise', () => {
    expect(evaluate('0.1+0.2', 2)).toEqual({ ok: true, value: 0.3 })
    expect(evaluate('1.005×1', 2)).toEqual({ ok: true, value: 1.01 })
  })

  it('reports an empty expression as empty, not zero', () => {
    expect(evaluate('', 2)).toEqual({ ok: false, reason: 'empty' })
    expect(evaluate('+', 2)).toEqual({ ok: false, reason: 'empty' })
  })

  it('reports division by zero rather than returning Infinity', () => {
    expect(evaluate('5÷0', 2)).toEqual({ ok: false, reason: 'divide-by-zero' })
    expect(evaluate('5÷0+1', 2)).toEqual({ ok: false, reason: 'divide-by-zero' })
  })

  it('reports a result too large to be exact', () => {
    expect(evaluate('999999999999×999999999999', 0)).toEqual({ ok: false, reason: 'overflow' })
  })

  // 鍵盤不會產生這些，但 evaluate 對任何字串都必須安全
  it('rejects malformed input instead of guessing', () => {
    expect(evaluate('1++2', 0)).toEqual({ ok: false, reason: 'invalid' })
    expect(evaluate('×3', 0)).toEqual({ ok: false, reason: 'invalid' })
    expect(evaluate('1.2.3', 2)).toEqual({ ok: false, reason: 'invalid' })
    expect(evaluate('alert(1)', 0)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('accepts ASCII operators and grouping commas', () => {
    expect(evaluate('1,200 - 200 * 2 / 4', 0)).toEqual({ ok: true, value: 1100 })
  })
})

describe('formatting', () => {
  it('groups thousands and spaces the operators', () => {
    expect(formatExpression('1200+800×2')).toBe('1,200 + 800 × 2')
  })

  it('leaves the fraction part ungrouped', () => {
    expect(formatExpression('1234.5678')).toBe('1,234.5678')
  })

  it('keeps a trailing decimal point visible while typing', () => {
    expect(formatExpression('12.')).toBe('12.')
  })

  it('formats a result to the currency decimals', () => {
    expect(formatResult(2800, 0)).toBe('2,800')
    expect(formatResult(12.5, 2)).toBe('12.50')
  })
})
