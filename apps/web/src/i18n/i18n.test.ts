import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectLocale, getLocale, setLocale, t, tPlural } from './index'

describe('t', () => {
  beforeEach(() => setLocale('zh-TW'))

  it('returns the string for the active locale', () => {
    expect(t('trip.new')).toBe('新增旅程')
    setLocale('en-US')
    expect(t('trip.new')).toBe('New Trip')
  })

  it('interpolates named parameters', () => {
    expect(t('settle.owes', { from: '小美', to: '阿明' })).toBe('小美 付給 阿明')
  })

  it('leaves an unknown placeholder untouched rather than printing undefined', () => {
    // 寧可讓開發者看到 {to} 也不要讓使用者看到 undefined
    expect(t('settle.owes', { from: '小美' })).toContain('{to}')
  })

  // 複數走 tPlural 而不是 t：複數 key 的參數一定要有 count，
  // 混在同一個函式裡型別表達不出這個要求
  it('selects the plural form through Intl.PluralRules', () => {
    setLocale('en-US')
    expect(tPlural('settle.transferCount', { count: 1 })).toBe('1 transfer')
    expect(tPlural('settle.transferCount', { count: 3 })).toBe('3 transfers')
    setLocale('zh-TW')
    // 中文沒有單複數之分，Intl.PluralRules 永遠回 other，所以只寫一份字串
    expect(tPlural('settle.transferCount', { count: 1 })).toBe('1 筆轉帳')
    expect(tPlural('settle.transferCount', { count: 3 })).toBe('3 筆轉帳')
  })
})

describe('locale', () => {
  it('round-trips through setLocale', () => {
    setLocale('en-US')
    expect(getLocale()).toBe('en-US')
  })

  it('sets document.documentElement.lang so screen readers pronounce the page correctly', () => {
    // 這個屬性不影響畫面外觀，只影響螢幕報讀器；如果 setLocale 悄悄不再設定它，
    // 畫面看起來完全正常但唸起來是錯的語言，測試就是唯一會發現的地方。
    setLocale('en-US')
    expect(document.documentElement.lang).toBe('en-US')
    setLocale('zh-TW')
    expect(document.documentElement.lang).toBe('zh-TW')
  })
})

describe('detectLocale', () => {
  const originalLanguages = navigator.languages

  afterEach(() => {
    Object.defineProperty(navigator, 'languages', {
      value: originalLanguages,
      configurable: true,
    })
  })

  function stubLanguages(languages: readonly string[]): void {
    Object.defineProperty(navigator, 'languages', {
      value: languages,
      configurable: true,
    })
  }

  it('detects an English preference', () => {
    stubLanguages(['en-US', 'en'])
    expect(detectLocale()).toBe('en-US')
  })

  it('detects a Chinese preference', () => {
    stubLanguages(['zh-TW', 'zh'])
    expect(detectLocale()).toBe('zh-TW')
  })

  // 迴圈是逐一檢查使用者自己的語言順序，一遇到看得懂的 tag（en 或 zh 開頭）就回傳，
  // 不是先把整個清單掃過一輪找 en 再找 zh。所以清單裡不支援的語言排在前面，
  // 只要它後面接著一個看得懂的 tag，就會用那個 tag，藉此釘住「照使用者順序，不是照
  // en 優先」這個行為。
  it('honours the user-order when an unsupported tag precedes a supported one', () => {
    stubLanguages(['fr-FR', 'zh-TW'])
    expect(detectLocale()).toBe('zh-TW')
  })

  it('falls back to zh-TW when languages is empty', () => {
    stubLanguages([])
    expect(detectLocale()).toBe('zh-TW')
  })

  it('falls back to zh-TW when navigator.languages is absent', () => {
    // @ts-expect-error 刻意模擬舊瀏覽器沒有 navigator.languages 的情況
    stubLanguages(undefined)
    expect(detectLocale()).toBe('zh-TW')
  })
})
