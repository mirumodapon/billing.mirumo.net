import {
  budgetStatus,
  byCategory,
  byDay,
  contributionOf,
  countsInTotals,
  decimalsOf,
  itemBreakdown,
  sharesOf,
  toMinor,
  type BudgetStatus,
  type Expense,
  type ItemShare,
  type Scope,
  type Trip,
} from '@billing/core'
import type { AccentSlot } from '@billing/ui'
import type { Category } from '../data/types'
import { t } from '../i18n'
import { displayName } from './names'

export interface StatsView {
  /** 目前口徑的總額，本位幣最小單位 */
  totalMinor: number
  /** 依 trip.budget.scope 算，與目前口徑無關（Plan 9 T2）。沒設總預算時不給 */
  budget?: BudgetStatus
  categories: { key: string; label: string; value: number; colorKey: AccentSlot }[]
  /** key 是日期；label 由畫面格式化 */
  days: { key: string; value: number }[]
  /** 目前口徑等於預算口徑、且有設每日預算時才給（Plan 9 T3） */
  dailyBudgetMinor?: number
  /** 僅全團：各成員該負擔的總額（規格 3.5） */
  members?: { id: string; name: string; colorKey: AccentSlot; owedMinor: number }[]
  /** 僅「我」：我分攤到的品項依金額降冪，攤回的服務費另計（規格 4.5） */
  items?: { rows: ItemShare[]; overflowMinor: number }
}

/** 併入「其他」的門檻（規格 3.5） */
const MERGE_BELOW = 0.03

/** 統計 tab 要的所有數字（Plan 9）。計算都交給 core，這裡只整理成畫面要的形狀 */
export function statsView(trip: Trip, expenses: Expense[], scope: Scope, categories: Category[]): StatsView {
  const order = trip.members.map((m) => m.id)
  const base = { scope, selfMemberId: trip.selfMemberId, baseCurrency: trip.baseCurrency, memberOrder: order }
  const live = expenses.filter(countsInTotals)
  const sum = (s: Scope) => live.reduce((total, e) => total + contributionOf(e, s, trip.selfMemberId, trip.baseCurrency, order), 0)
  const minor = (v: number) => toMinor(v, decimalsOf(trip.baseCurrency))

  const view: StatsView = {
    totalMinor: sum(scope),
    // 我沒分到的類別金額是 0，併進「其他」後仍會留下一個 0 的區塊：一律拿掉
    categories: byCategory(live, { ...base, mergeThreshold: MERGE_BELOW })
      .filter((c) => c.totalMinor !== 0)
      .map((c) => {
        const category = categories.find((x) => x.id === c.categoryId)
        // 併出來的「其他」可能不在設定裡（Plan 9 T6）
        return {
          key: c.categoryId,
          label: category ? displayName(category) : c.categoryId === 'cat.other' ? t('cat.other') : c.categoryId,
          value: c.totalMinor,
          colorKey: category?.colorKey ?? 'accent8',
        }
      }),
    days: byDay(live, { ...base, trip }).map((d) => ({ key: d.date, value: d.totalMinor })),
  }

  const { total, daily, scope: budgetScope } = trip.budget
  if (total !== undefined) view.budget = budgetStatus(sum(budgetScope), minor(total))
  if (daily !== undefined && budgetScope === scope) view.dailyBudgetMinor = minor(daily)

  if (scope === 'group') {
    const owed: Record<string, number> = {}
    for (const e of live) {
      for (const [id, share] of Object.entries(sharesOf(e, trip.baseCurrency, order))) owed[id] = (owed[id] ?? 0) + share
    }
    view.members = trip.members.map((m) => ({ id: m.id, name: m.name, colorKey: m.colorKey, owedMinor: owed[m.id] ?? 0 }))
  } else {
    const { items, overflowMinor } = itemBreakdown(live, { selfMemberId: trip.selfMemberId, baseCurrency: trip.baseCurrency, memberOrder: order })
    view.items = { rows: [...items].sort((x, y) => y.shareMinor - x.shareMinor), overflowMinor }
  }
  return view
}
