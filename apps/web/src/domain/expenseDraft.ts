import {
  decimalsOf,
  fromMinor,
  resolveRate,
  sharesOf,
  toMinor,
  type AttachmentMeta,
  type Expense,
  type OverflowRule,
  type Split,
  type Trip,
} from '@billing/core'
import type { AppSettings } from '../data/types'
import { paymentMethodsFor } from './paymentMethods'

/**
 * 新增／編輯支出表單的狀態（Plan 7）。
 *
 * 與 Expense 的差別都是「填到一半」才有的狀態：金額與匯率可以還沒有、指定金額
 * 可以還沒填、品項金額可以還沒輸入。所有規則都是這個檔案裡的純函式，畫面只負責畫。
 */

export interface ItemDraft {
  id: string
  name: string
  amount: number | undefined
  participants: string[]
}

export type SplitDraft =
  | { mode: 'even'; participants: string[] }
  | { mode: 'exact'; amounts: Record<string, number | undefined> }
  | { mode: 'items'; items: ItemDraft[]; overflowRule: OverflowRule }

export interface ExpenseDraft {
  /** 編輯既有支出時才有 */
  id?: string
  amount: number | undefined
  currency: string
  /** undefined：沒有匯率可帶入，等使用者輸入 */
  exchangeRate: number | undefined
  /** 使用者親手改過匯率，或這是既有支出（E4）：之後改付款方式不再覆寫 */
  rateTouched: boolean
  description: string
  date: string
  categoryId: string
  paymentMethodId: string
  paidBy: string
  split: SplitDraft
  attachments: AttachmentMeta[]
  /**
   * 使用者把它標成草稿（task#96）。選填：舊版自動保存的表單沒有這個欄位。
   * 欄位還沒填完時不論這裡怎麼設，一律存成草稿——見 willSaveAsDraft
   */
  isDraft?: boolean
  /** 這一筆是替哪一張預存卡儲值（task#115）。選填：一般支出沒有 */
  topUpFor?: string
}

export interface DraftContext {
  trip: Trip
  /** 這趟旅程的支出：「上一筆用的幣別」從這裡找（E1） */
  expenses: Expense[]
  settings: AppSettings
  /** 當地日期 'YYYY-MM-DD' */
  today: string
}

export type DraftProblem =
  | 'amountRequired'
  | 'descriptionRequired'
  | 'rateRequired'
  | 'noParticipants'
  | 'exactUnbalanced'
  | 'noItems'
  | 'itemWithoutParticipants'
  | 'itemWithoutAmount'

const memberOrder = (trip: Trip) => trip.members.map((m) => m.id)

/** 規格 4.4 的帶入順序：幣別×付款方式 → 幣別預設 → 空白。本位幣恆為 1 */
function autoRate(trip: Trip, currency: string, paymentMethodId: string): number | undefined {
  return currency === trip.baseCurrency ? 1 : resolveRate(trip.rates, currency, paymentMethodId)
}

/** 金額一律換成最小單位再比，0.1 + 0.2 才會等於 0.3 */
const minor = (value: number | undefined, currency: string) => toMinor(value ?? 0, decimalsOf(currency))

export function newDraft({ trip, expenses, settings, today }: DraftContext): ExpenseDraft {
  // 「上一筆」是最後記下的那一筆，不是日期最晚的那一筆
  const latest = expenses.filter((e) => !e.deletedAt).reduce<Expense | undefined>((a, e) => (!a || e.createdAt > a.createdAt ? e : a), undefined)
  const currency = latest?.currency ?? settings.lastUsed.currency ?? trip.baseCurrency
  // 上一筆用的項目後來被刪了，就退回第一個：不能帶入一個不存在的 id
  const pick = (id: string | undefined, list: { id: string }[]) => (id && list.some((x) => x.id === id) ? id : (list[0]?.id ?? ''))
  // 旅程專用的付款方式也算（task#92）：上一筆用的是它的話照樣帶入
  const paymentMethodId = pick(settings.lastUsed.paymentMethodId, paymentMethodsFor(settings.paymentMethods, trip))
  return {
    amount: undefined,
    currency,
    exchangeRate: autoRate(trip, currency, paymentMethodId),
    rateTouched: false,
    description: '',
    date: today >= trip.startDate && today <= trip.endDate ? today : trip.startDate,
    // 類別不帶入：每一筆都自己選（使用者要求）。也可以一直不選，就是「未分類」（task#127）
    categoryId: '',
    paymentMethodId,
    paidBy: trip.selfMemberId,
    // task#121：預設只有付款人自己分攤；要分給別人再加（分攤區塊有「全選」）
    split: { mode: 'even', participants: [trip.selfMemberId] },
    attachments: [],
    isDraft: false,
  }
}

export function draftFromExpense(e: Expense): ExpenseDraft {
  const split: SplitDraft =
    e.split.mode === 'items'
      ? { mode: 'items', overflowRule: e.split.overflowRule, items: e.split.items.map((i) => ({ ...i, participants: [...i.participants] })) }
      : e.split.mode === 'exact'
        ? { mode: 'exact', amounts: { ...e.split.amounts } }
        : { mode: 'even', participants: [...e.split.participants] }
  // 草稿存的時候缺什麼就記 0（task#96）；打開時還原成「未填」，匯率也恢復自動帶入
  const missingAmount = e.draft === true && e.amount === 0
  const missingRate = e.draft === true && e.exchangeRate === 0
  return {
    id: e.id,
    amount: missingAmount ? undefined : e.amount,
    currency: e.currency,
    exchangeRate: missingRate ? undefined : e.exchangeRate,
    rateTouched: !missingRate,
    description: e.description,
    date: e.date,
    categoryId: e.categoryId,
    paymentMethodId: e.paymentMethodId,
    paidBy: e.paidBy,
    split,
    attachments: [...e.attachments],
    isDraft: e.draft === true,
    ...(e.topUpFor ? { topUpFor: e.topUpFor } : {}),
  }
}

/**
 * 換付款人（task#121）。分攤還是預設的「只有原付款人」時跟著換成新的付款人；
 * 使用者動過分攤（加了人、換了模式）就不碰，免得蓋掉他的選擇。
 */
export function withPayer(d: ExpenseDraft, paidBy: string): ExpenseDraft {
  const untouched = d.split.mode === 'even' && d.split.participants.length === 1 && d.split.participants[0] === d.paidBy
  return untouched ? { ...d, paidBy, split: { mode: 'even', participants: [paidBy] } } : { ...d, paidBy }
}

export function withAutoRate(d: ExpenseDraft, trip: Trip): ExpenseDraft {
  return d.rateTouched ? d : { ...d, exchangeRate: autoRate(trip, d.currency, d.paymentMethodId) }
}

export function withManualRate(d: ExpenseDraft, rate: number | undefined): ExpenseDraft {
  return { ...d, exchangeRate: rate, rateTouched: true }
}

export function exactAllocation(d: ExpenseDraft): { allocated: number; remaining: number } {
  const decimals = decimalsOf(d.currency)
  const values = d.split.mode === 'exact' ? Object.values(d.split.amounts) : []
  const allocatedMinor = values.reduce<number>((sum, v) => sum + minor(v, d.currency), 0)
  return { allocated: fromMinor(allocatedMinor, decimals), remaining: fromMinor(minor(d.amount, d.currency) - allocatedMinor, decimals) }
}

export function itemsTotals(d: ExpenseDraft): { itemsTotal: number; overflow: number } {
  const decimals = decimalsOf(d.currency)
  const items = d.split.mode === 'items' ? d.split.items : []
  const itemsMinor = items.reduce((sum, i) => sum + minor(i.amount, d.currency), 0)
  return { itemsTotal: fromMinor(itemsMinor, decimals), overflow: fromMinor(minor(d.amount, d.currency) - itemsMinor, decimals) }
}

/** 用預存卡付款（不是儲值）：只扣餘額、不算進任何合計（task#115） */
function isCardPayment(d: ExpenseDraft, storedMethods: ReadonlySet<string>): boolean {
  return !d.topUpFor && storedMethods.has(d.paymentMethodId)
}

/**
 * 還沒填完的欄位。storedMethods 是這趟旅程的預存卡：用卡付的不算進合計，
 * 換成本位幣沒有意義，所以不要求匯率（task#119）
 */
export function problemsOf(d: ExpenseDraft, storedMethods: ReadonlySet<string> = new Set()): DraftProblem[] {
  const problems: DraftProblem[] = []
  if (minor(d.amount, d.currency) <= 0) problems.push('amountRequired')
  if (!d.description.trim()) problems.push('descriptionRequired')
  const hasRate = d.exchangeRate !== undefined && d.exchangeRate > 0
  if (!hasRate && !isCardPayment(d, storedMethods)) problems.push('rateRequired')
  const split = d.split
  if (split.mode === 'even' && split.participants.length === 0) problems.push('noParticipants')
  if (split.mode === 'exact' && exactAllocation(d).remaining !== 0) problems.push('exactUnbalanced')
  if (split.mode === 'items') {
    if (split.items.length === 0) problems.push('noItems')
    if (split.items.some((i) => i.participants.length === 0)) problems.push('itemWithoutParticipants')
    if (split.items.some((i) => i.amount === undefined)) problems.push('itemWithoutAmount')
  }
  return problems
}

function toSplit(split: SplitDraft, currency: string): Split {
  if (split.mode === 'even') return { mode: 'even', participants: [...split.participants] }
  if (split.mode === 'exact') {
    // 沒填或填 0 的人不存：他沒有分攤，不是分攤了 0
    const amounts = Object.fromEntries(
      Object.entries(split.amounts).filter((entry): entry is [string, number] => entry[1] !== undefined && minor(entry[1], currency) !== 0),
    )
    return { mode: 'exact', amounts }
  }
  return {
    mode: 'items',
    overflowRule: split.overflowRule,
    items: split.items.map((i) => ({ id: i.id, name: i.name, amount: i.amount ?? 0, participants: [...i.participants] })),
  }
}

/** 使用者標了草稿，或還有欄位沒填完：存下去會是一筆草稿（task#96） */
export function willSaveAsDraft(d: ExpenseDraft, storedMethods: ReadonlySet<string> = new Set()): boolean {
  return d.isDraft === true || problemsOf(d, storedMethods).length > 0
}

/**
 * 轉成要存的紀錄。欄位不完整也可以：那時存成草稿，缺的金額與匯率記 0（task#96）。
 * 用預存卡付的蓋上 fromBalance：只扣餘額、不算進合計；儲值那一筆記下替哪張卡加值（task#115）。
 * storedMethods 是這趟旅程的預存卡 id，由呼叫端提供。
 * 時間戳留空：由 Repository 蓋（規格 7.1）
 */
export function toExpense(d: ExpenseDraft, tripId: string, storedMethods: ReadonlySet<string> = new Set()): Expense {
  return {
    ...(willSaveAsDraft(d, storedMethods) ? { draft: true } : {}),
    ...(d.topUpFor ? { topUpFor: d.topUpFor } : isCardPayment(d, storedMethods) ? { fromBalance: true } : {}),
    id: d.id ?? crypto.randomUUID(),
    tripId,
    date: d.date,
    description: d.description.trim(),
    categoryId: d.categoryId,
    paymentMethodId: d.paymentMethodId,
    paidBy: d.paidBy,
    amount: d.amount ?? 0,
    currency: d.currency,
    // 規格 2.5：匯率在這一刻寫死進這一筆，之後改旅程的匯率表不會回頭改它
    exchangeRate: d.exchangeRate ?? 0,
    split: toSplit(d.split, d.currency),
    attachments: [...d.attachments],
    createdAt: '',
    updatedAt: '',
  }
}

/**
 * 分攤預覽，本位幣最小單位。一律經過 core 的 sharesOf：自己算的話，除不盡時
 * 那 1 分錢落在誰身上可能與存檔後的結算不一樣。
 */
export function previewShares(d: ExpenseDraft, trip: Trip): Record<string, number> | undefined {
  if (d.amount === undefined || d.exchangeRate === undefined) return undefined
  try {
    return sharesOf(toExpense(d, trip.id), trip.baseCurrency, memberOrder(trip))
  } catch {
    return undefined
  }
}

/** 新增品項：參與者沿用上一項（規格 4.4：連續點餐多半同一群人），第一項用全員 */
export function addItem(d: ExpenseDraft, trip: Trip): ExpenseDraft {
  if (d.split.mode !== 'items') return d
  const last = d.split.items.at(-1)
  const item: ItemDraft = { id: crypto.randomUUID(), name: '', amount: undefined, participants: last ? [...last.participants] : memberOrder(trip) }
  return { ...d, split: { ...d.split, items: [...d.split.items, item] } }
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
const isOptionalNumber = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v))

/**
 * 從 DraftStore 讀回來的東西是不是一份可用的草稿（規格 7.9）。
 *
 * 草稿會跨版本存活：舊版存的形狀、或寫到一半的資料，不能把表單弄壞。
 * 形狀不對就當作沒有草稿——那是便利，不是資料。
 */
export function isExpenseDraft(value: unknown): value is ExpenseDraft {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  const strings = ['currency', 'description', 'date', 'categoryId', 'paymentMethodId', 'paidBy'] as const
  if (!strings.every((k) => typeof d[k] === 'string')) return false
  if (d.id !== undefined && typeof d.id !== 'string') return false
  if (!isOptionalNumber(d.amount) || !isOptionalNumber(d.exchangeRate)) return false
  if (typeof d.rateTouched !== 'boolean' || !Array.isArray(d.attachments)) return false
  if (d.isDraft !== undefined && typeof d.isDraft !== 'boolean') return false
  if (d.topUpFor !== undefined && typeof d.topUpFor !== 'string') return false
  const split = d.split as Record<string, unknown> | null
  if (typeof split !== 'object' || split === null) return false
  if (split.mode === 'even') return isStringArray(split.participants)
  if (split.mode === 'exact') {
    const amounts = split.amounts
    return typeof amounts === 'object' && amounts !== null && Object.values(amounts).every(isOptionalNumber)
  }
  if (split.mode === 'items') {
    return (
      (split.overflowRule === 'prorata' || split.overflowRule === 'even') &&
      Array.isArray(split.items) &&
      split.items.every((i: Record<string, unknown>) => typeof i?.id === 'string' && typeof i.name === 'string' && isOptionalNumber(i.amount) && isStringArray(i.participants))
    )
  }
  return false
}
