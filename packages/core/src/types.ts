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

/**
 * 只用於這趟旅程的付款方式（task#92），例如當地的交通卡。全域的付款方式在 app 的設定裡，
 * core 不需要知道——計算只認 paymentMethodId 這個字串。
 */
export interface TripPaymentMethod {
  id: string
  name: string
  /** 預存卡（task#115），例如 Suica：可以儲值、用它付款只扣餘額。餘額以這個幣別計 */
  storedValue?: { currency: string }
}

/**
 * 只用於這趟旅程的類別（task#114），例如「滑雪場」。與全域自訂類別同樣有名稱、圖示與顏色；
 * 圖示名稱由 app 解讀（core 不認識 ui 的圖示清單），計算只認 categoryId。
 */
export interface TripCategory {
  id: string
  name: string
  icon: string
  colorKey: AccentKey
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
  /** 這趟旅程專用的付款方式；選填，舊資料沒有這個欄位 */
  paymentMethods?: TripPaymentMethod[]
  /** 這趟旅程專用的類別；選填，舊資料沒有這個欄位（task#114） */
  categories?: TripCategory[]
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
  /** 草稿：看得到、改得了，但不算進任何合計（task#96）。選填，舊資料沒有這個欄位 */
  draft?: boolean
  /**
   * 用預存卡付的：只扣那張卡的餘額，不算進任何合計——錢在儲值時就算過了（task#115）。
   * 存檔時依付款方式蓋上，不在讀取時推算，改了卡的設定也不會回頭改舊帳
   */
  fromBalance?: boolean
  /** 儲值：替這趟旅程的哪一張預存卡加值。它本身是一筆照常計算的支出（task#115） */
  topUpFor?: string

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
  /** 草稿：不算進淨額（task#96） */
  draft?: boolean
  /** ISO 8601 UTC，如 `2026-03-15T08:30:00.000Z`。儲存層與匯出格式都依賴這個形狀 */
  createdAt: string
  updatedAt: string
  deletedAt?: string
}
