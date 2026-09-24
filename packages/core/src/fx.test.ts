import { describe, expect, it } from 'vitest'
import { resolveRate } from './fx'
import type { ExchangeRateTable } from './types'

const rates: ExchangeRateTable = {
  default: { JPY: 0.21, KRW: 0.023 },
  byMethod: { 'JPY|pay.cash': 0.215, 'JPY|pay.credit': 0.2128 },
}

describe('resolveRate', () => {
  it('prefers the currency × payment method rate', () => {
    expect(resolveRate(rates, 'JPY', 'pay.cash')).toBe(0.215)
    expect(resolveRate(rates, 'JPY', 'pay.credit')).toBe(0.2128)
  })

  it('falls back to the currency default when the method has no rate', () => {
    expect(resolveRate(rates, 'JPY', 'pay.mobile')).toBe(0.21)
  })

  it('falls back to the currency default when byMethod is empty', () => {
    expect(resolveRate(rates, 'KRW', 'pay.cash')).toBe(0.023)
  })

  it('returns undefined for a currency with no rate at all', () => {
    expect(resolveRate(rates, 'EUR', 'pay.cash')).toBeUndefined()
  })

  it('returns undefined rather than 0 so the UI can leave the field blank', () => {
    expect(resolveRate({ default: {}, byMethod: {} }, 'USD', 'pay.cash')).toBeUndefined()
  })
})
