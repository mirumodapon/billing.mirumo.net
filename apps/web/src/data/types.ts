import type { AccentKey, Expense, Transfer, Trip } from '@billing/core'
import type { CategoryIconName, ThemeFamily, ThemeId } from '@billing/ui'

/**
 * 這幾個型別放在 app 而不是 core（規格 2.1）：Category.icon 的型別來自 ui 的
 * 圖示白名單，放進 core 會造成 core → ui 的反向相依。
 */

export interface Category {
  /** 內建：'cat.food'（同時是 i18n key）；自訂：隨機 id */
  id: string
  /** 只有自訂類別才有，存使用者輸入的字面值，不翻譯 */
  name?: string
  icon: CategoryIconName
  colorKey: AccentKey
  builtin: boolean
}

export interface PaymentMethod {
  /** 內建：'pay.cash'（同時是 i18n key）；自訂：隨機 id */
  id: string
  name?: string
  builtin: boolean
}

export interface AppSettings {
  schemaVersion: number
  locale: 'system' | 'zh-TW' | 'en-US'
  theme: ThemeId | 'system'
  /** theme 為 'system' 時用哪個家族的明暗配對 */
  themeFamily: ThemeFamily
  categories: Category[]
  paymentMethods: PaymentMethod[]
  /** 支出表單的預設值來源（規格 4.4） */
  lastUsed: {
    currency?: string
    categoryId?: string
    paymentMethodId?: string
  }
  /**
   * 支出列表的外幣支出要不要同時顯示換算後的本位幣（task#99）。
   * 選填、沒有就是顯示：舊的設定與舊的備份不必遷移
   */
  showBaseAmounts?: boolean
}

export const APP_ID = 'billing-travel-split'

/** 匯出格式的版本。改動 Snapshot 的形狀時加一，並在 migrations.ts 補一步遷移 */
export const SNAPSHOT_VERSION = 1

/** 設定的版本，規則同上 */
export const SETTINGS_VERSION = 1

export interface Snapshot {
  schemaVersion: number
  /** ISO 8601 UTC */
  exportedAt: string
  app: typeof APP_ID
  settings: AppSettings
  trips: Trip[]
  expenses: Expense[]
  transfers: Transfer[]
}

export interface SessionState {
  route: string
  tripId?: string
  statsScope?: 'self' | 'group'
  filters?: { categoryIds: string[]; memberIds: string[] }
  openAccordion?: string
  /** key 是路由 */
  scrollTop?: Record<string, number>
}
