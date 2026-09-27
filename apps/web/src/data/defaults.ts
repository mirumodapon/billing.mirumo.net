import type { TranslationKey } from '../i18n'
import type { AppSettings, Category, PaymentMethod } from './types'
import { SETTINGS_VERSION } from './types'

/**
 * 內建項目的 id 同時是 i18n key（規格 13.6）。`id: TranslationKey` 讓拼錯或
 * 語言檔少一個 key 變成編譯錯誤，而不是畫面上冒出一串 'cat.fod'。
 */
type Builtin<T> = T & { id: TranslationKey; builtin: true }

/*
 * 顏色槽位刻意跳著選。12 個 accent 裡有幾對在多數主題下幾乎一樣
 * （task#81：accent5/accent6、accent8/accent9 等），內建的六類不該撞在一起。
 */
export const BUILTIN_CATEGORIES: readonly Builtin<Category>[] = [
  { id: 'cat.food', icon: 'IconToolsKitchen2', colorKey: 'accent1', builtin: true },
  { id: 'cat.transport', icon: 'IconCar', colorKey: 'accent8', builtin: true },
  { id: 'cat.lodging', icon: 'IconBed', colorKey: 'accent10', builtin: true },
  { id: 'cat.shopping', icon: 'IconShoppingBag', colorKey: 'accent4', builtin: true },
  { id: 'cat.ticket', icon: 'IconTicket', colorKey: 'accent2', builtin: true },
  { id: 'cat.other', icon: 'IconDots', colorKey: 'accent12', builtin: true },
]

export const BUILTIN_PAYMENT_METHODS: readonly Builtin<PaymentMethod>[] = [
  { id: 'pay.cash', builtin: true },
  { id: 'pay.credit', builtin: true },
  { id: 'pay.mobile', builtin: true },
]

/** 全新安裝時的設定。每次呼叫回傳新物件，呼叫端改了也不會污染下一次 */
export function defaultSettings(): AppSettings {
  return {
    schemaVersion: SETTINGS_VERSION,
    locale: 'system',
    theme: 'system',
    themeFamily: 'catppuccin',
    categories: BUILTIN_CATEGORIES.map((c) => ({ ...c })),
    paymentMethods: BUILTIN_PAYMENT_METHODS.map((p) => ({ ...p })),
    lastUsed: {},
  }
}
