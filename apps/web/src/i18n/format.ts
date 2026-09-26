import { decimalsOf, fromMinor } from '@billing/core'
import { getLocale } from './index'

/** 'YYYY-MM-DD' → Date，一律以 UTC 解析，避免時區讓日期差一天 */
function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function formatMoney(minor: number, currency: string): string {
  const decimals = decimalsOf(currency)
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fromMinor(minor, decimals))
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
