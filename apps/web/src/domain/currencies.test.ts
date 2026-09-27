import { CURRENCY_DECIMALS } from '@billing/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CURRENCIES, currencyName } from './currencies'

afterEach(() => {
  vi.unstubAllGlobals()

})

describe('CURRENCIES', () => {
  // 少一個就代表有幣別的小數位數定義了卻選不到；多一個就是選得到卻沒有小數位數
  it('offers exactly the currencies core knows the decimals of', () => {
    expect([...CURRENCIES].sort()).toEqual(Object.keys(CURRENCY_DECIMALS).sort())
  })

  it('puts the home currency of most users first', () => {
    expect(CURRENCIES.slice(0, 3)).toEqual(['TWD', 'JPY', 'KRW'])
  })
})

describe('currencyName', () => {
  it('names a currency in the given language', () => {
    expect(currencyName('JPY', 'zh-TW')).toContain('日圓')
    expect(currencyName('JPY', 'en-US')).toContain('Yen')
  })

  it('falls back to the code where the platform has no names', () => {
    vi.stubGlobal('Intl', { ...Intl, DisplayNames: undefined })
    expect(currencyName('JPY', 'zh-TW')).toBe('JPY')
  })
})
