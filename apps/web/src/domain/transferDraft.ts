import { decimalsOf, toMinor, type Transfer, type TransferKind, type Trip } from '@billing/core'

/** 轉帳表單的狀態（Plan 8）。與 Transfer 的差別：金額與匯率可以還沒有 */
export interface TransferDraft {
  id?: string
  from: string
  to: string
  amount: number | undefined
  currency: string
  exchangeRate: number | undefined
  /** 使用者親手改過匯率，或這是既有轉帳：之後換幣別不再覆寫 */
  rateTouched: boolean
  date: string
  kind: TransferKind
  note: string
  /**
   * 使用者要把這筆存成草稿（task#96）：不算進結算。
   * 欄位還沒填完時不論這裡怎麼設，一律存成草稿——見 willSaveTransferAsDraft
   */
  isDraft?: boolean
}

/** 「已結清」帶來的預填（Plan 8 S1、S3） */
export interface TransferPrefill {
  from?: string
  to?: string
  amount?: number
  kind?: TransferKind
}

export type TransferProblem = 'amountRequired' | 'rateRequired' | 'sameMember'

/** 轉帳沒有付款方式這個維度：只看幣別的預設匯率（S2）。本位幣恆為 1 */
function autoRate(trip: Trip, currency: string): number | undefined {
  return currency === trip.baseCurrency ? 1 : trip.rates.default[currency]
}

export function newTransferDraft({ trip, today }: { trip: Trip; today: string }, prefill: TransferPrefill = {}): TransferDraft {
  const self = trip.selfMemberId
  const other = trip.members.find((m) => m.id !== self)?.id ?? self
  return {
    from: prefill.from ?? self,
    to: prefill.to ?? other,
    amount: prefill.amount,
    // 建議是本位幣算的，預填一律用本位幣：換成外幣再換回來會多一次取整
    currency: trip.baseCurrency,
    exchangeRate: 1,
    rateTouched: false,
    date: today >= trip.startDate && today <= trip.endDate ? today : trip.startDate,
    kind: prefill.kind ?? 'loan',
    note: '',
    isDraft: false,
  }
}

export function transferDraftFrom(t: Transfer): TransferDraft {
  // 草稿存的時候缺什麼就記 0（task#96）；打開時還原成「未填」，匯率也恢復自動帶入
  const missingAmount = t.draft === true && t.amount === 0
  const missingRate = t.draft === true && t.exchangeRate === 0
  return {
    id: t.id,
    from: t.from,
    to: t.to,
    amount: missingAmount ? undefined : t.amount,
    currency: t.currency,
    exchangeRate: missingRate ? undefined : t.exchangeRate,
    // 規格 2.5：建立時固化的匯率，編輯時不被今天的匯率表改掉
    rateTouched: !missingRate,
    date: t.date,
    kind: t.kind,
    note: t.note,
    isDraft: t.draft === true,
  }
}

export function withAutoTransferRate(d: TransferDraft, trip: Trip): TransferDraft {
  return d.rateTouched ? d : { ...d, exchangeRate: autoRate(trip, d.currency) }
}

export function withManualTransferRate(d: TransferDraft, rate: number | undefined): TransferDraft {
  return { ...d, exchangeRate: rate, rateTouched: true }
}

export function transferProblems(d: TransferDraft): TransferProblem[] {
  const problems: TransferProblem[] = []
  if (toMinor(d.amount ?? 0, decimalsOf(d.currency)) <= 0) problems.push('amountRequired')
  if (d.exchangeRate === undefined || !(d.exchangeRate > 0)) problems.push('rateRequired')
  // 自己轉給自己在數學上無害，但一定是按錯（S4）
  if (d.from === d.to) problems.push('sameMember')
  return problems
}

/** 使用者要求，或還有欄位沒填完：這次存檔會是草稿 */
export function willSaveTransferAsDraft(d: TransferDraft): boolean {
  return d.isDraft === true || transferProblems(d).length > 0
}

/**
 * 轉成要存的紀錄。欄位不完整也可以：那時存成草稿，缺的金額與匯率記 0（task#96）。
 * 時間戳留空：由 Repository 蓋
 */
export function toTransfer(d: TransferDraft, tripId: string): Transfer {
  return {
    ...(willSaveTransferAsDraft(d) ? { draft: true } : {}),
    id: d.id ?? crypto.randomUUID(),
    tripId,
    date: d.date,
    from: d.from,
    to: d.to,
    amount: d.amount ?? 0,
    currency: d.currency,
    exchangeRate: d.exchangeRate ?? 0,
    kind: d.kind,
    note: d.note.trim(),
    createdAt: '',
    updatedAt: '',
  }
}

const isOptionalNumber = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v))

/** 從 DraftStore 讀回的東西是不是一份可用的轉帳草稿；形狀不對就當作沒有 */
export function isTransferDraft(value: unknown): value is TransferDraft {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  const strings = ['from', 'to', 'currency', 'date', 'note'] as const
  return (
    strings.every((k) => typeof d[k] === 'string') &&
    (d.id === undefined || typeof d.id === 'string') &&
    isOptionalNumber(d.amount) &&
    isOptionalNumber(d.exchangeRate) &&
    typeof d.rateTouched === 'boolean' &&
    (d.isDraft === undefined || typeof d.isDraft === 'boolean') &&
    (d.kind === 'loan' || d.kind === 'settlement')
  )
}

/** 網址帶來的預填是外部輸入：不認得的成員、不是正數的金額、不存在的 kind 一律丟掉 */
export function parsePrefill(search: URLSearchParams, trip: Trip): TransferPrefill {
  const ids = new Set(trip.members.map((m) => m.id))
  const prefill: TransferPrefill = {}
  const from = search.get('from')
  const to = search.get('to')
  const amount = Number(search.get('amount'))
  const kind = search.get('kind')
  if (from && ids.has(from)) prefill.from = from
  if (to && ids.has(to)) prefill.to = to
  if (search.has('amount') && Number.isFinite(amount) && amount > 0) prefill.amount = amount
  if (kind === 'loan' || kind === 'settlement') prefill.kind = kind
  return prefill
}
