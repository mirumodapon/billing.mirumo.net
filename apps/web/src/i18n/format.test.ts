import { describe, expect, it } from 'vitest'
import { setLocale } from './index'
import { parseDate, formatBytes, formatCompact, formatDate, formatDateRange, formatMoney, formatWeekday } from './format'

describe('formatMoney', () => {
  it('formats a zero-decimal currency without decimals', () => {
    setLocale('zh-TW')
    // 798 個最小單位的 TWD 就是 798 元
    expect(formatMoney(798, 'TWD')).toMatch(/798/)
    expect(formatMoney(798, 'TWD')).not.toMatch(/\.00/)
  })

  it('formats a two-decimal currency with decimals', () => {
    setLocale('en-US')
    expect(formatMoney(1234, 'USD')).toMatch(/12\.34/)
  })

  // task#98：zh-TW 的新台幣是「$」、en-US 的美元是「$」，同一個符號在兩個語系指不同的錢
  it('always spells out NT$ and US$ so the currency is never ambiguous', () => {
    for (const locale of ['zh-TW', 'en-US'] as const) {
      setLocale(locale)
      expect(formatMoney(1500, 'TWD'), locale).toMatch(/^NT\$1,500$/)
      expect(formatMoney(1234, 'USD'), locale).toMatch(/^US\$12\.34$/)
      expect(formatMoney(-400, 'TWD'), locale).toMatch(/^-NT\$400$/)
    }
  })

  it('keeps the platform symbol for other currencies', () => {
    setLocale('zh-TW')
    expect(formatMoney(3000, 'JPY')).toBe(new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(3000))
  })

  it('handles negatives', () => {
    setLocale('zh-TW')
    expect(formatMoney(-500, 'TWD')).toMatch(/-|−|\(/)
  })
})

describe('formatDate', () => {
  /*
   * 這兩個語系在「數字月/日」這個格式下輸出完全相同，所以不能寫成
   * 「兩者應該不同」——那條斷言不可能成立。改成釘住各自的實際輸出：
   * 比「有差異」更強，格式選項被改動時會直接紅。
   *
   * 「真的有讀取 locale」這件事由 formatWeekday 與 formatDateRange 證明，
   * 那兩個在兩個語系下確實不同。
   */
  it('formats the same way in both locales for this compact format', () => {
    setLocale('zh-TW')
    expect(formatDate('2026-03-15')).toBe('3/15')
    setLocale('en-US')
    expect(formatDate('2026-03-15')).toBe('3/15')
  })

  // 用 UTC 解析，否則在 UTC+8 以外的時區會差一天
  it('does not shift the day across time zones', () => {
    setLocale('en-US')
    expect(formatDate('2026-03-15')).toMatch(/15/)
  })
})

describe('formatWeekday', () => {
  it('returns a short weekday name', () => {
    setLocale('en-US')
    expect(formatWeekday('2026-03-15')).toBe('Sun')
  })
})

describe('formatDateRange', () => {
  it('joins two dates', () => {
    setLocale('en-US')
    expect(formatDateRange('2026-03-14', '2026-03-18')).toMatch(/14.*18/)
  })

  // 範圍分隔符號在兩個語系下不同（zh-TW 用「至」，en-US 用 en dash），
  // 這條才是真正證明 formatDate 系列有讀 locale 的斷言。
  it('localises the range separator', () => {
    setLocale('zh-TW')
    const zh = formatDateRange('2026-03-14', '2026-03-18')
    setLocale('en-US')
    const en = formatDateRange('2026-03-14', '2026-03-18')
    expect(zh).not.toBe(en)
  })
})

/*
 * 這條刻意不依賴執行時的時區：直接比對解析出來的那一瞬間。
 * 少了它，「把 ISO 當成本地時間解析」這個錯誤只有在 UTC 以東的機器上才會被抓到，
 * 在 UTC 或美洲時區下測試照樣全綠——而旅行記帳把日期記錯一天是使用者看得見的 bug。
 */
describe('parseDate', () => {
  it('reads a plain date as UTC midnight, whatever the machine zone', () => {
    expect(parseDate('2026-03-15').toISOString()).toBe('2026-03-15T00:00:00.000Z')
  })
})

describe('formatCompact', () => {
  // 圖表刻度的寬度有限：不寫幣別符號，大數字縮寫（Plan 9 走查）
  it('drops the currency and shortens large numbers', () => {
    setLocale('en-US')
    expect(formatCompact(2000, 'TWD')).toBe('2K')
    expect(formatCompact(150000, 'USD')).toBe('1.5K')
    setLocale('zh-TW')
    expect(formatCompact(500, 'TWD')).toBe('500')
    expect(formatCompact(15000, 'TWD')).toBe('1.5萬')
  })
})

describe('formatBytes', () => {
  it('picks a unit and keeps one decimal below 100', () => {
    setLocale('en-US')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(40_000)).toBe('40 KB')
    expect(formatBytes(1_234_567)).toBe('1.2 MB')
    expect(formatBytes(123_456_789)).toBe('123 MB')
  })
})
