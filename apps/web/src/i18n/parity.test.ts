import { CATEGORY_ICONS } from '@billing/ui'
import { describe, expect, it } from 'vitest'
import { enUS, enUSPlurals } from './en-US'
import { zhTW, zhTWPlurals } from './zh-TW'

const placeholders = (s: string): string[] =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()

describe('translation parity', () => {
  it('uses the same placeholders in both locales', () => {
    for (const key of Object.keys(zhTW) as (keyof typeof zhTW)[]) {
      expect(placeholders(enUS[key]), `placeholders differ for ${key}`).toEqual(
        placeholders(zhTW[key]),
      )
    }
  })

  it('uses the same placeholders in every plural form', () => {
    for (const key of Object.keys(zhTWPlurals) as (keyof typeof zhTWPlurals)[]) {
      const want = placeholders(zhTWPlurals[key])
      expect(placeholders(enUSPlurals[key].one), `${key}.one`).toEqual(want)
      expect(placeholders(enUSPlurals[key].other), `${key}.other`).toEqual(want)
    }
  })

  it('has no empty strings', () => {
    // 兩個表的 key 完全相同，所以 { ...zhTW, ...enUS } 會讓英文整組蓋掉中文，
    // 只檢查到一半。分開檢查，並且複數表也要檢查。
    const entries: [string, string][] = [
      ...Object.entries(zhTW).map(([k, v]): [string, string] => [`zhTW.${k}`, v]),
      ...Object.entries(enUS).map(([k, v]): [string, string] => [`enUS.${k}`, v]),
      ...Object.entries(zhTWPlurals).map(([k, v]): [string, string] => [`zhTWPlurals.${k}`, v]),
      ...Object.entries(enUSPlurals).flatMap(([k, v]): [string, string][] => [
        [`enUSPlurals.${k}.one`, v.one],
        [`enUSPlurals.${k}.other`, v.other],
      ]),
    ]
    expect(entries.length).toBeGreaterThan(0)
    for (const [label, value] of entries) {
      expect(value.trim(), `${label} is empty`).not.toBe('')
    }
  })

  /*
   * 複數 key 必須用到 count，否則單複數根本不會有差別。
   *
   * 這裡只斷言英文的 .other，看起來漏掉 .one，但上面那條 parity 測試已經
   * 強制 .one 的變數集合等於中文那份，而這條又要求中文那份含有 count——
   * 英文 .one 漏掉 count 仍然會被抓到，只是由另一條測試發出聲音。
   */
  it('references count in every plural form', () => {
    for (const key of Object.keys(zhTWPlurals) as (keyof typeof zhTWPlurals)[]) {
      expect(placeholders(zhTWPlurals[key])).toContain('count')
      expect(placeholders(enUSPlurals[key].other)).toContain('count')
    }
  })
})

describe('category icon names (task#87)', () => {
  // 圖示選擇器的無障礙名稱查這張表：新增圖示時忘了寫名稱，螢幕閱讀器就會念出 key
  it('names every category icon in both languages', () => {
    for (const name of Object.keys(CATEGORY_ICONS)) {
      const key = `icon.${name.replace(/^Icon/, '')}`
      expect(zhTW[key as keyof typeof zhTW], key).toBeTruthy()
      expect(enUS[key as keyof typeof enUS], key).toBeTruthy()
    }
  })
})
