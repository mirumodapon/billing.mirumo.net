import { useSettings } from '../stores/StoresProvider'
import { formatDate, formatDateRange, formatMoney } from './format'
import { t, tPlural } from './index'

/**
 * 元件取用翻譯與格式化的入口。
 *
 * 訂閱語系只為了在切換時觸發重繪（規格 6.5：不需重新載入）；t() 本身讀的是
 * settingsStore 在更新前就用 setLocale 設好的模組變數。
 */
export function useI18n() {
  const locale = useSettings((s) => s.locale)
  return { locale, t, tPlural, money: formatMoney, date: formatDate, dateRange: formatDateRange }
}
