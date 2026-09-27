import { CURRENCY_DECIMALS } from '@billing/core'

/**
 * 可選的幣別，依使用頻率排序（使用者以台灣旅客為主）。
 * 集合必須與 core 的 CURRENCY_DECIMALS 一致：那張表決定每個幣別的最小單位，
 * 選得到卻不在表裡的幣別會被當成兩位小數，日圓就會算錯一百倍。
 */
const ORDER = ['TWD', 'JPY', 'KRW', 'USD', 'EUR', 'HKD', 'CNY', 'THB', 'SGD', 'GBP', 'VND', 'MYR', 'PHP', 'IDR', 'AUD', 'CAD']

export const CURRENCIES: readonly string[] = ORDER.filter((c) => c in CURRENCY_DECIMALS)

export function currencyName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}
