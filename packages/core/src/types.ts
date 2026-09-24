export type AccentKey =
  | 'accent1' | 'accent2' | 'accent3' | 'accent4'
  | 'accent5' | 'accent6' | 'accent7' | 'accent8'
  | 'accent9' | 'accent10' | 'accent11' | 'accent12'

export type Scope = 'self' | 'group'

export interface Member {
  id: string
  name: string
  colorKey: AccentKey
}

/** 幣別 × 付款方式 的二維匯率表 */
export interface ExchangeRateTable {
  /** key: currency，如 'JPY' */
  default: Record<string, number>
  /** key: `${currency}|${paymentMethodId}`，如 'JPY|pay.cash' */
  byMethod: Record<string, number>
}

export interface TripBudget {
  /** 本位幣十進位金額。未設定為 undefined，不用 0 當預設 */
  total?: number
  daily?: number
  scope: Scope
}

export interface Trip {
  id: string
  name: string
  destination: string
  /** 'YYYY-MM-DD' */
  startDate: string
  endDate: string
  baseCurrency: string
  members: Member[]
  /** 「我」是誰，個人統計的口徑 */
  selfMemberId: string
  budget: TripBudget
  rates: ExchangeRateTable
  /** ISO 8601 UTC，如 `2026-03-15T08:30:00.000Z`。儲存層與匯出格式都依賴這個形狀 */
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface LineItem {
  id: string
  /** 可留空，UI 顯示為「品項 N」 */
  name: string
  /** 原始幣別金額 */
  amount: number
  /** 這一項由誰分攤，項內均分 */
  participants: string[]
}

/** 明細加總與總額的差額如何攤回 */
export type OverflowRule = 'prorata' | 'even'

export type Split =
  | { mode: 'even'; participants: string[] }
  /** key: memberId，value 為原始幣別金額 */
  | { mode: 'exact'; amounts: Record<string, number> }
  | { mode: 'items'; items: LineItem[]; overflowRule: OverflowRule }

export interface AttachmentMeta {
  /** BlobStore 的 key */
  id: string
  mimeType: string
  byteSize: number
  width: number
  height: number
}

export interface Expense {
  id: string
  tripId: string
  /** 'YYYY-MM-DD' */
  date: string
  description: string
  categoryId: string
  paymentMethodId: string
  /** memberId */
  paidBy: string

  /** 原始幣別金額 */
  amount: number
  currency: string
  /** 對 baseCurrency 的匯率，建立時固化，不回查旅程匯率表 */
  exchangeRate: number

  split: Split
  attachments: AttachmentMeta[]

  /** ISO 8601 UTC，如 `2026-03-15T08:30:00.000Z`。儲存層與匯出格式都依賴這個形狀 */
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

/** 僅影響顯示與分組，不影響任何計算 */
export type TransferKind = 'loan' | 'settlement'

export interface Transfer {
  id: string
  tripId: string
  date: string
  /** memberId，給錢的人 */
  from: string
  /** memberId，收錢的人 */
  to: string
  amount: number
  currency: string
  exchangeRate: number
  kind: TransferKind
  note: string
  /** ISO 8601 UTC，如 `2026-03-15T08:30:00.000Z`。儲存層與匯出格式都依賴這個形狀 */
  createdAt: string
  updatedAt: string
  deletedAt?: string
}
