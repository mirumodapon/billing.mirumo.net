import { ACCENT_ORDER } from '@billing/ui'
import { describe, expect, it } from 'vitest'
import { t, setLocale } from '../i18n'
import { BUILTIN_CATEGORIES, BUILTIN_PAYMENT_METHODS, defaultSettings } from './defaults'

describe('defaults', () => {
  // 規格 13.6 的六個內建類別與三個付款方式，逐字釘住
  it('ships exactly the built-in categories and payment methods the spec lists', () => {
    expect(BUILTIN_CATEGORIES.map((c) => c.id)).toEqual([
      'cat.food', 'cat.transport', 'cat.lodging', 'cat.shopping', 'cat.ticket', 'cat.other',
    ])
    expect(BUILTIN_PAYMENT_METHODS.map((p) => p.id)).toEqual(['pay.cash', 'pay.credit', 'pay.mobile'])
  })

  // 內建項目存 id 而不是字面值，切換語系名稱才會跟著變
  it('names built-ins through i18n in both locales', () => {
    setLocale('zh-TW')
    expect(t('cat.food')).toBe('餐飲')
    setLocale('en-US')
    expect(t('cat.food')).toBe('Food')
    expect(t('pay.credit')).toBe('Credit card')
  })

  // task#81：內建六類取指派順序的前六格——那是彼此差最多的六個
  it('colours the built-in categories with the first six slots of the assignment order', () => {
    expect(BUILTIN_CATEGORIES.map((c) => c.colorKey)).toEqual(ACCENT_ORDER.slice(0, 6))
  })

  // 回傳的是新物件：呼叫端改了設定不能污染下一次的預設值
  it('returns a fresh copy every time', () => {
    const a = defaultSettings()
    a.categories[0]!.colorKey = 'accent12'
    a.lastUsed.currency = 'JPY'
    const b = defaultSettings()
    expect(b.categories[0]!.colorKey).toBe(ACCENT_ORDER[0])
    expect(b.lastUsed.currency).toBeUndefined()
  })
})
