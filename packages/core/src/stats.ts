import { convertToBaseMinor, decimalsOf, toMinor } from './money'
import { sharesOf, sortByMemberOrder, splitEven } from './split'
import type { Expense, Scope, Trip } from './types'

const alive = <T extends { deletedAt?: string }>(x: T) => x.deletedAt === undefined

export interface StatsOptions {
  scope: Scope
  selfMemberId: string
  baseCurrency: string
  memberOrder: string[]
}

/**
 * 一筆支出計入統計的金額。
 *
 * `self` 口徑問的是「我該負擔多少」，不是「我先墊了多少」，
 * 所以付款人是誰完全不影響結果。這與結算頁的口徑不同，兩者各答各的問題。
 */
export function contributionOf(
  expense: Expense,
  scope: Scope,
  selfMemberId: string,
  baseCurrency: string,
  memberOrder: string[],
): number {
  if (scope === 'group') {
    return convertToBaseMinor(expense.amount, expense.exchangeRate, baseCurrency)
  }
  return sharesOf(expense, baseCurrency, memberOrder)[selfMemberId] ?? 0
}

export interface CategoryStat {
  categoryId: string
  totalMinor: number
  /** 佔總額的比例，0–1 */
  ratio: number
}

export interface ByCategoryOptions extends StatsOptions {
  /** 佔比低於此值的類別併入 cat.other，避免圓餅圖碎裂。預設不合併 */
  mergeThreshold?: number
}

export function byCategory(expenses: Expense[], opts: ByCategoryOptions): CategoryStat[] {
  const totals: Record<string, number> = {}
  for (const e of expenses.filter(alive)) {
    const value = contributionOf(e, opts.scope, opts.selfMemberId, opts.baseCurrency, opts.memberOrder)
    totals[e.categoryId] = (totals[e.categoryId] ?? 0) + value
  }

  const grand = Object.values(totals).reduce((x, y) => x + y, 0)
  if (grand === 0) {
    return Object.keys(totals).length === 0
      ? []
      : Object.entries(totals).map(([categoryId, totalMinor]) => ({ categoryId, totalMinor, ratio: 0 }))
  }

  const threshold = opts.mergeThreshold ?? 0
  const kept: CategoryStat[] = []
  let mergedMinor = 0

  for (const [categoryId, totalMinor] of Object.entries(totals)) {
    const ratio = totalMinor / grand
    if (threshold > 0 && ratio < threshold && categoryId !== 'cat.other') {
      mergedMinor += totalMinor
    } else {
      kept.push({ categoryId, totalMinor, ratio })
    }
  }

  if (mergedMinor > 0) {
    const existing = kept.find((k) => k.categoryId === 'cat.other')
    if (existing) {
      existing.totalMinor += mergedMinor
      existing.ratio = existing.totalMinor / grand
    } else {
      kept.push({ categoryId: 'cat.other', totalMinor: mergedMinor, ratio: mergedMinor / grand })
    }
  }

  return kept.sort((x, y) => y.totalMinor - x.totalMinor)
}

export interface DayStat {
  /** 'YYYY-MM-DD' */
  date: string
  totalMinor: number
  overBudget: boolean
}

export interface ByDayOptions extends StatsOptions {
  trip: Trip
  /** 每日預算，本位幣最小單位。未設則永不標示超支 */
  dailyBudgetMinor?: number
}

/** 以 UTC 逐日推進，避免時區造成日期跳號 */
function eachDate(startDate: string, endDate: string): string[] {
  const out: string[] = []
  const end = Date.parse(`${endDate}T00:00:00Z`)
  let cursor = Date.parse(`${startDate}T00:00:00Z`)
  while (cursor <= end) {
    out.push(new Date(cursor).toISOString().slice(0, 10))
    cursor += 86_400_000
  }
  return out
}

/**
 * 每日花費。
 *
 * X 軸取「旅程區間 ∪ 有支出的日期」的聯集——誤記在區間外的支出
 * （出發前的訂金、回國後的帳單）不會被藏起來。
 */
export function byDay(expenses: Expense[], opts: ByDayOptions): DayStat[] {
  const totals: Record<string, number> = {}
  for (const e of expenses.filter(alive)) {
    const value = contributionOf(e, opts.scope, opts.selfMemberId, opts.baseCurrency, opts.memberOrder)
    totals[e.date] = (totals[e.date] ?? 0) + value
  }

  const dates = new Set([...eachDate(opts.trip.startDate, opts.trip.endDate), ...Object.keys(totals)])

  return [...dates]
    .sort()
    .map((date) => {
      const totalMinor = totals[date] ?? 0
      return {
        date,
        totalMinor,
        overBudget: opts.dailyBudgetMinor !== undefined && totalMinor > opts.dailyBudgetMinor,
      }
    })
}

export interface BudgetStatus {
  budgetMinor: number
  usedMinor: number
  /** 可為負數，表示超支 */
  remainingMinor: number
  ratio: number
  level: 'normal' | 'warning' | 'over'
}

export function budgetStatus(usedMinor: number, budgetMinor: number): BudgetStatus {
  const ratio = budgetMinor === 0 ? (usedMinor > 0 ? Infinity : 0) : usedMinor / budgetMinor
  const level = ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'normal'
  return {
    budgetMinor,
    usedMinor,
    remainingMinor: budgetMinor - usedMinor,
    ratio,
    level,
  }
}

export interface ItemShare {
  expenseId: string
  /** 非明細支出為 null */
  itemId: string | null
  name: string
  date: string
  categoryId: string
  shareMinor: number
}

export interface ItemBreakdown {
  items: ItemShare[]
  /** 不屬於任何品項的分攤額（服務費、稅、折扣的攤回部分） */
  overflowMinor: number
}

export interface ItemBreakdownOptions {
  selfMemberId: string
  baseCurrency: string
  memberOrder: string[]
}

/**
 * 「我的消費明細」：列出我實際分攤到的每一項。
 *
 * 明細支出逐品項列出；非明細支出以整筆為一項，`itemId` 為 null。
 * 服務費等攤回的金額不屬於任何品項，累計進 overflowMinor 單獨呈現——
 * 把它硬塞進某個品項會讓數字對不上收據。
 */
export function itemBreakdown(
  expenses: Expense[],
  opts: ItemBreakdownOptions,
): ItemBreakdown {
  const { selfMemberId, baseCurrency, memberOrder } = opts
  const decimals = decimalsOf(baseCurrency)
  const items: ItemShare[] = []
  let overflowMinor = 0

  for (const e of expenses.filter(alive)) {
    const myShare = sharesOf(e, baseCurrency, memberOrder)[selfMemberId] ?? 0
    if (myShare === 0) continue

    if (e.split.mode !== 'items') {
      items.push({
        expenseId: e.id,
        itemId: null,
        name: e.description,
        date: e.date,
        categoryId: e.categoryId,
        shareMinor: myShare,
      })
      continue
    }

    let itemised = 0
    for (const item of e.split.items) {
      if (!item.participants.includes(selfMemberId)) continue
      const itemMinor = toMinor(item.amount * e.exchangeRate, decimals)
      const ordered = sortByMemberOrder(item.participants, memberOrder)
      const share = splitEven(itemMinor, ordered)[selfMemberId] ?? 0
      if (share === 0) continue
      itemised += share
      items.push({
        expenseId: e.id,
        itemId: item.id,
        name: item.name,
        date: e.date,
        categoryId: e.categoryId,
        shareMinor: share,
      })
    }
    overflowMinor += myShare - itemised
  }

  items.sort((x, y) => y.shareMinor - x.shareMinor)
  return { items, overflowMinor }
}
