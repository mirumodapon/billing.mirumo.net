import { countsInTotals } from './records'
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

  for (const e of expenses.filter(countsInTotals)) {
    const totalMinor = convertToBaseMinor(e.amount, e.exchangeRate, trip.baseCurrency)
    paid[e.paidBy] = (paid[e.paidBy] ?? 0) + totalMinor
    for (const [id, share] of Object.entries(sharesOf(e, trip.baseCurrency, memberOrder))) {
      owed[id] = (owed[id] ?? 0) + share
    }
  }

  // 轉帳只改變「誰欠誰」，不改變「花了多少」，所以不進 paid/owed
  for (const t of transfers.filter(countsInTotals)) {
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

export interface TransferSuggestion {
  from: string
  to: string
  amountMinor: number
}

/**
 * 最少轉帳建議（貪婪法）。
 *
 * 每輪取淨額最大的債權人與欠最多的債務人配對，轉帳金額取兩者絕對值較小者。
 *
 * 最小化轉帳筆數在一般情況下是 NP-hard，貪婪法不保證絕對最少，
 * 但保證不超過 n−1 筆，且在真實的旅遊分帳規模（3–8 人）幾乎總是最優。
 * 同分時以 balances 的原始順序（= 旅程成員順序）決勝，確保輸出穩定不跳動。
 */
export function minimalTransfers(balances: Balance[]): TransferSuggestion[] {
  const creditors = balances
    .filter((b) => b.netMinor > 0)
    .map((b) => ({ id: b.memberId, net: b.netMinor }))
  const debtors = balances
    .filter((b) => b.netMinor < 0)
    .map((b) => ({ id: b.memberId, net: -b.netMinor }))

  const out: TransferSuggestion[] = []

  while (creditors.length > 0 && debtors.length > 0) {
    // 穩定排序：值相同時維持原順序，所以結果可重現
    creditors.sort((x, y) => y.net - x.net)
    debtors.sort((x, y) => y.net - x.net)

    const c = creditors[0]!
    const d = debtors[0]!
    const amountMinor = Math.min(c.net, d.net)

    out.push({ from: d.id, to: c.id, amountMinor })
    c.net -= amountMinor
    d.net -= amountMinor

    if (c.net === 0) creditors.shift()
    if (d.net === 0) debtors.shift()
  }

  return out
}
