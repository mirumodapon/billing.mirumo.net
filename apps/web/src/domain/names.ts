import type { Category, PaymentMethod } from '../data/types'
import { t, type TranslationKey } from '../i18n'

/**
 * 類別與付款方式的顯示名稱（規格 2.1）：內建的 id 就是 i18n key，隨語系切換；
 * 自訂的存使用者輸入的字面值，不翻譯。
 */
export function displayName(item: Category | PaymentMethod): string {
  return item.builtin ? t(item.id as TranslationKey) : (item.name ?? item.id)
}
