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
import { categoryLabel } from './categories'

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
  items?: { rows: (ItemShare & { expenseName: string })[]; overflowMinor: number }
}

/** 併入「其他」的門檻（規格 3.5） */
const MERGE_BELOW = 0.03

/**
 * 統計 tab 要的所有數字（Plan 9）。計算都交給 core，這裡只整理成畫面要的形狀。
 *
 * `self` 口徑看的是 memberId 那個人該負擔的部分（預設是我），可以切到任何成員的視角。
 * 預算不跟著換人：個人預算是「我」的預算。
 */
export function statsView(trip: Trip, expenses: Expense[], scope: Scope, categories: Category[], memberId: string = trip.selfMemberId): StatsView {
  const order = trip.members.map((m) => m.id)
  const base = { scope, selfMemberId: memberId, baseCurrency: trip.baseCurrency, memberOrder: order }
  const live = expenses.filter(countsInTotals)
  const sum = (s: Scope, who: string) => live.reduce((total, e) => total + contributionOf(e, s, who, trip.baseCurrency, order), 0)
  const minor = (v: number) => toMinor(v, decimalsOf(trip.baseCurrency))

  const view: StatsView = {
    totalMinor: sum(scope, memberId),
    // 我沒分到的類別金額是 0，併進「其他」後仍會留下一個 0 的區塊：一律拿掉
    categories: byCategory(live, { ...base, mergeThreshold: MERGE_BELOW })
      .filter((c) => c.totalMinor !== 0)
      .map((c) => {
        const category = categories.find((x) => x.id === c.categoryId)
        // 併出來的「其他」可能不在設定裡（Plan 9 T6）
        return {
          key: c.categoryId,
          // 沒選類別的叫「未分類」（task#127）
          label: !category && c.categoryId === 'cat.other' ? t('cat.other') : categoryLabel(category, c.categoryId),
          value: c.totalMinor,
          colorKey: category?.colorKey ?? 'accent8',
        }
      }),
    days: byDay(live, { ...base, trip }).map((d) => ({ key: d.date, value: d.totalMinor })),
  }

  const { total, daily, scope: budgetScope } = trip.budget
  if (total !== undefined) view.budget = budgetStatus(sum(budgetScope, trip.selfMemberId), minor(total))
  // 每日預算線只在看的正是預算那個口徑時畫：全團預算配全團、我的預算配我自己（Plan 9 T3）
  const sameAsBudget = budgetScope === scope && (scope === 'group' || memberId === trip.selfMemberId)
  if (daily !== undefined && sameAsBudget) view.dailyBudgetMinor = minor(daily)

  if (scope === 'group') {
    const owed: Record<string, number> = {}
    for (const e of live) {
      for (const [id, share] of Object.entries(sharesOf(e, trip.baseCurrency, order))) owed[id] = (owed[id] ?? 0) + share
    }
    view.members = trip.members.map((m) => ({ id: m.id, name: m.name, colorKey: m.colorKey, owedMinor: owed[m.id] ?? 0 }))
  } else {
    const { items, overflowMinor } = itemBreakdown(live, { selfMemberId: memberId, baseCurrency: trip.baseCurrency, memberOrder: order })
    // 明細品項另外帶上那一筆的說明（task#112）：只寫「生啤」看不出是哪一次；整筆的列名字本來就是說明
    const nameOf = (id: string) => live.find((e) => e.id === id)?.description.trim() ?? ''
    const rows = items.map((row) => ({ ...row, expenseName: row.itemId === null ? '' : nameOf(row.expenseId) }))
    view.items = { rows: rows.sort((x, y) => y.shareMinor - x.shareMinor), overflowMinor }
  }
  return view
}
