import { convertToBaseMinor } from './money'
import { sharesOf } from './split'
import type { Expense, Transfer, Trip } from './types'

export interface Balance {
  memberId: string
  /** 這個人實際付出去的金額（本位幣最小單位） */
  paidMinor: number
  /** 這個人應該負擔的金額 */
  owedMinor: number
  /** 正數 = 別人欠我；負數 = 我欠別人 */
  netMinor: number
}

const alive = <T extends { deletedAt?: string }>(x: T) => x.deletedAt === undefined

/**
 * 各成員的收支淨額。
 *
 * `Σ netMinor === 0` 是數學上保證的：每筆支出的分攤加總恆等於該筆總額
 * （由 sharesOf 保證），而每筆轉帳對總和的貢獻是 +x 與 −x。
 * 因此這裡不需要任何修正步驟。
 */
export function netBalances(
  trip: Trip,
  expenses: Expense[],
  transfers: Transfer[],
): Balance[] {
  const memberOrder = trip.members.map((m) => m.id)
  const paid: Record<string, number> = {}
  const owed: Record<string, number> = {}
  const moved: Record<string, number> = {}
  for (const id of memberOrder) {
    paid[id] = 0
    owed[id] = 0
    moved[id] = 0
  }

  for (const e of expenses.filter(alive)) {
    const totalMinor = convertToBaseMinor(e.amount, e.exchangeRate, trip.baseCurrency)
    paid[e.paidBy] = (paid[e.paidBy] ?? 0) + totalMinor
    for (const [id, share] of Object.entries(sharesOf(e, trip.baseCurrency, memberOrder))) {
      owed[id] = (owed[id] ?? 0) + share
    }
  }

  // 轉帳只改變「誰欠誰」，不改變「花了多少」，所以不進 paid/owed
  for (const t of transfers.filter(alive)) {
    const amountMinor = convertToBaseMinor(t.amount, t.exchangeRate, trip.baseCurrency)
    moved[t.from] = (moved[t.from] ?? 0) + amountMinor
    moved[t.to] = (moved[t.to] ?? 0) - amountMinor
  }

  return memberOrder.map((memberId) => {
    const paidMinor = paid[memberId] ?? 0
    const owedMinor = owed[memberId] ?? 0
    return {
      memberId,
      paidMinor,
      owedMinor,
      netMinor: paidMinor - owedMinor + (moved[memberId] ?? 0),
    }
  })
}
