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

/**
 * 支出列表的篩選（task#106）。同一個維度內是「任一」，不同維度之間是「而且」；
 * 空陣列代表這個維度不設限。
 */
export interface ExpenseFilter {
  categoryIds: string[]
  payers: string[]
  paymentMethodIds: string[]
  draftsOnly: boolean
}

export interface SessionState {
  route: string
  tripId?: string
  statsScope?: 'self' | 'group'
  /** 統計從哪位成員的視角看（statsScope 為 self 時）。沒有或已不在旅程裡就是我 */
  statsMember?: string
  /** 帶著旅程 id：換到別趟旅程時不能套用上一趟的成員與類別（task#91） */
  filters?: ExpenseFilter & { tripId: string }
  openAccordion?: string
  /** 統計頁收起的區塊（Plan 9 T4）。預設全部展開，只記收起的 */
  collapsedStats?: string[]
  /** key 是路由 */
  scrollTop?: Record<string, number>
}
