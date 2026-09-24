import type { ExchangeRateTable } from './types'

/** byMethod 的 key 格式 */
export function rateKey(currency: string, paymentMethodId: string): string {
  return `${currency}|${paymentMethodId}`
}

/**
 * 匯率帶入順序：幣別 × 付款方式 → 幣別預設 → undefined。
 *
 * 回傳 undefined 而非 0，是為了讓 UI 能區分「沒有匯率，欄位留白等使用者輸入」
 * 與「匯率真的是 0」。回傳 0 會讓所有金額換算成 0 且無聲無息。
 */
export function resolveRate(
  rates: ExchangeRateTable,
  currency: string,
  paymentMethodId: string,
): number | undefined {
  return rates.byMethod[rateKey(currency, paymentMethodId)] ?? rates.default[currency]
}
