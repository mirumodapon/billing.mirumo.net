import { budgetStatus, contributionOf, decimalsOf, toMinor, type BudgetStatus, type Expense, type Trip } from '@billing/core'
import type { TripRepository } from '../data/tripRepository'

export interface TripSummary {
  /** 全團總支出，本位幣最小單位 */
  spentMinor: number
  /** 沒設總預算時為 undefined：規格 3.6 要求那時連進度條都不畫 */
  budget?: BudgetStatus
}

export function summarizeTrip(trip: Trip, expenses: Expense[]): TripSummary {
  const live = expenses.filter((e) => !e.deletedAt)
  const order = trip.members.map((m) => m.id)
  const total = (scope: 'self' | 'group') =>
    live.reduce((sum, e) => sum + contributionOf(e, scope, trip.selfMemberId, trip.baseCurrency, order), 0)
  const spentMinor = total('group')
  if (trip.budget.total === undefined) return { spentMinor }
  const budgetMinor = toMinor(trip.budget.total, decimalsOf(trip.baseCurrency))
  return { spentMinor, budget: budgetStatus(total(trip.budget.scope), budgetMinor) }
}

/**
 * 旅程列表卡片要的數字（Plan 6 D2）。
 *
 * 規格 7.5 說首頁不載支出，4.2 又要卡片顯示總支出與預算：這裡逐趟讀支出、
 * 當場算完只回傳數字，支出陣列不會進 store。
 */
export async function summarizeTrips(repo: TripRepository, trips: Trip[]): Promise<Record<string, TripSummary>> {
  const entries = await Promise.all(trips.map(async (trip) => [trip.id, summarizeTrip(trip, await repo.listExpenses(trip.id))] as const))
  return Object.fromEntries(entries)
}
