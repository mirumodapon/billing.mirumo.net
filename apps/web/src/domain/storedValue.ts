import { decimalsOf, isLive, toMinor, type Expense, type Trip } from '@billing/core'

/**
 * 預存卡（task#115），例如 Suica。儲值那一筆是照常計算的支出；之後用卡付的
 * 只扣餘額、不算進任何合計（core 的 countsInTotals 已經排除 fromBalance）。
 * 只有旅程專用的付款方式可以是預存卡。
 */

export function storedMethodIds(trip: Pick<Trip, 'paymentMethods'>): Set<string> {
  return new Set((trip.paymentMethods ?? []).filter((m) => m.storedValue).map((m) => m.id))
}

export interface StoredBalance {
  currency: string
  /** 卡片幣別的最小單位；可以是負的（付得比儲值多，多半是漏記了儲值） */
  minor: number
}

/** 每張預存卡的餘額：儲值加上、用卡付的扣掉。只算成立的紀錄（不含刪除與草稿） */
export function storedBalances(trip: Pick<Trip, 'paymentMethods'>, expenses: readonly Expense[]): Record<string, StoredBalance> {
  const out: Record<string, StoredBalance> = {}
  for (const method of trip.paymentMethods ?? []) {
    if (!method.storedValue) continue
    const { currency } = method.storedValue
    const minor = (e: Expense) => toMinor(e.amount, decimalsOf(currency))
    // 幣別不同的紀錄不動餘額：表單會把預存卡的儲值與付款鎖在卡片的幣別
    const live = expenses.filter((e) => isLive(e) && e.currency === currency)
    const added = live.filter((e) => e.topUpFor === method.id).reduce((sum, e) => sum + minor(e), 0)
    const spent = live.filter((e) => e.fromBalance && e.paymentMethodId === method.id).reduce((sum, e) => sum + minor(e), 0)
    out[method.id] = { currency, minor: added - spent }
  }
  return out
}
