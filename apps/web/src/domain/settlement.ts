import { minimalTransfers, netBalances, type Expense, type Transfer, type TransferSuggestion, type Trip } from '@billing/core'
import type { TranslationKey } from '../i18n'

export interface BalanceRow {
  memberId: string
  name: string
  /** 正數 = 別人欠他；負數 = 他欠別人（本位幣最小單位） */
  netMinor: number
  status: 'receive' | 'pay' | 'settled'
}

export interface PendingTransfer extends TransferSuggestion {
  fromName: string
  toName: string
}

export interface SettlementView {
  /** 依成員順序 */
  balances: BalanceRow[]
  /** 最少轉帳建議（core 的貪婪法，不超過 n−1 筆） */
  pending: PendingTransfer[]
  /** 應為 0（規格 3.4 的數學保證）。畫面不顯示，測試與開發期檢查用 */
  totalNet: number
}

/**
 * 結算頁要的資料形狀（規格 3.4、4.6）。計算全部在 core 的 netBalances 與
 * minimalTransfers（軟刪除的紀錄也是 core 濾掉的）；這裡只補上名字與狀態。
 */
export function settlementView(trip: Trip, expenses: Expense[], transfers: Transfer[]): SettlementView {
  const balances = netBalances(trip, expenses, transfers)
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? id
  return {
    balances: balances.map((b) => ({
      memberId: b.memberId,
      name: name(b.memberId),
      netMinor: b.netMinor,
      // Plan 8 S5：最小單位的整數，0 就是結清，沒有容差問題
      status: b.netMinor > 0 ? 'receive' : b.netMinor < 0 ? 'pay' : 'settled',
    })),
    pending: minimalTransfers(balances).map((s) => ({ ...s, fromName: name(s.from), toName: name(s.to) })),
    totalNet: balances.reduce((sum, b) => sum + b.netMinor, 0),
  }
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

/** 淨額帶正負號：正數補上 +，負數由 Intl 自己帶 − */
export function signedMoney(minor: number, currency: string, money: (minor: number, currency: string) => string): string {
  return minor > 0 ? `+${money(minor, currency)}` : money(minor, currency)
}

/**
 * 分享用的純文字摘要（規格 4.6，Plan 8 S6）：各人淨額與尚待結清的每一筆。
 * 不含轉帳紀錄——分享是為了「接下來誰付誰」，貼到群組太長沒人看。
 */
export function shareText(trip: Trip, view: SettlementView, t: Translate, money: (minor: number, currency: string) => string): string {
  const status = { receive: t('settle.receive'), pay: t('settle.pay'), settled: t('settle.settled') }
  const lines = [t('settle.shareTitle', { trip: trip.name }), '']
  for (const b of view.balances) lines.push(`${b.name} ${signedMoney(b.netMinor, trip.baseCurrency, money)} ${status[b.status]}`)
  lines.push('')
  if (view.pending.length === 0) lines.push(t('settle.allSettled'))
  else {
    lines.push(t('settle.pending'))
    for (const p of view.pending) lines.push(`${t('settle.owes', { from: p.fromName, to: p.toName })} ${money(p.amountMinor, trip.baseCurrency)}`)
  }
  return lines.join('\n')
}
