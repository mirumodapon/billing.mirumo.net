import { decimalsOf, fromMinor } from '@billing/core'
import { getLocale } from './index'

/** 'YYYY-MM-DD' → Date，一律以 UTC 解析，避免時區讓日期差一天 */
export function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

/**
 * 同一個「$」在兩個語系指不同的錢：zh-TW 的新台幣是 $、en-US 的美元是 $（task#98）。
 * 這兩個幣別一律寫明，其餘沿用平台的符號（人民幣本來就是 CN¥，不會與日圓 ¥ 混淆）。
 */
const EXPLICIT_SYMBOL: Record<string, string> = { TWD: 'NT$', USD: 'US$' }

export function formatMoney(minor: number, currency: string): string {
  const decimals = decimalsOf(currency)
  const parts = new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).formatToParts(fromMinor(minor, decimals))
  const symbol = EXPLICIT_SYMBOL[currency]
  return parts.map((p) => (p.type === 'currency' && symbol ? symbol : p.value)).join('')
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(getLocale(), {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parseDate(iso))
}

export function formatWeekday(iso: string): string {
  return new Intl.DateTimeFormat(getLocale(), { weekday: 'short', timeZone: 'UTC' }).format(
    parseDate(iso),
  )
}

export function formatDateRange(startIso: string, endIso: string): string {
  return new Intl.DateTimeFormat(getLocale(), {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatRange(parseDate(startIso), parseDate(endIso))
}

/** 圖表刻度用的精簡寫法：不寫幣別、大數字縮寫（「2K」「1.5萬」）。完整金額另有表格與數值標籤 */
export function formatCompact(minor: number, currency: string): string {
  return new Intl.NumberFormat(getLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(fromMinor(minor, decimalsOf(currency)))
}
