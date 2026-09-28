import type { Expense } from '@billing/core'
import type { ExpenseFilter } from '../data/types'

export type { ExpenseFilter }

export const EMPTY_FILTER: ExpenseFilter = { categoryIds: [], payers: [], paymentMethodIds: [], draftsOnly: false }

const allows = (chosen: readonly string[], value: string) => chosen.length === 0 || chosen.includes(value)

export function filterExpenses(expenses: readonly Expense[], f: ExpenseFilter): Expense[] {
  return expenses.filter(
    (e) =>
      allows(f.categoryIds, e.categoryId) &&
      allows(f.payers, e.paidBy) &&
      allows(f.paymentMethodIds, e.paymentMethodId) &&
      (!f.draftsOnly || e.draft === true),
  )
}

export function isFilterActive(f: ExpenseFilter): boolean {
  return f.categoryIds.length > 0 || f.payers.length > 0 || f.paymentMethodIds.length > 0 || f.draftsOnly
}

export function toggleIn(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** 篩選面板要列的選項：這趟旅程用過的，加上已選的（否則選了之後就取消不掉） */
export function usedIds(expenses: readonly Expense[], pick: (e: Expense) => string, chosen: readonly string[]): Set<string> {
  return new Set([...expenses.map(pick), ...chosen])
}
