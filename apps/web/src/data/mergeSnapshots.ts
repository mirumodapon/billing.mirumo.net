import type { Snapshot } from './types'

type Stamped = { id: string; updatedAt: string }

/** 同一個 id 保留 updatedAt 較新的；平手時保留本機的，重複匯入同一份備份不會改動任何東西 */
function newerWins<T extends Stamped>(local: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(local.map((row) => [row.id, row]))
  for (const row of incoming) {
    const mine = byId.get(row.id)
    if (!mine || row.updatedAt > mine.updatedAt) byId.set(row.id, row)
  }
  return [...byId.values()]
}

function unionById<T extends { id: string }>(local: readonly T[], incoming: readonly T[]): T[] {
  const ids = new Set(local.map((row) => row.id))
  return [...local, ...incoming.filter((row) => !ids.has(row.id))]
}

/**
 * 合併兩份快照。紀錄以 updatedAt 較新者為準——這是規格 2.6 為同步預留
 * updatedAt 的用途。設定沿用本機的，只補上備份裡有而本機沒有的類別與付款方式，
 * 否則匯入的支出會引用到不存在的類別。
 *
 * 純函式：結果是否自洽由呼叫端再驗證一次。
 */
export function mergeSnapshots(local: Snapshot, incoming: Snapshot): Snapshot {
  return {
    ...local,
    settings: {
      ...local.settings,
      categories: unionById(local.settings.categories, incoming.settings.categories),
      paymentMethods: unionById(local.settings.paymentMethods, incoming.settings.paymentMethods),
    },
    trips: newerWins(local.trips, incoming.trips),
    expenses: newerWins(local.expenses, incoming.expenses),
    transfers: newerWins(local.transfers, incoming.transfers),
  }
}
