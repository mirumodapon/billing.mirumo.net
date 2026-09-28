import { openTravelDb } from './db'

/** 刪除後在資料庫裡多留多久（使用者決定：3 天）。這段期間內資料都還在，之後在 app 啟動時清掉 */
export const GRACE_MS = 3 * 24 * 60 * 60 * 1000

export interface HousekeepingResult {
  trips: number
  expenses: number
  transfers: number
  drafts: number
  blobs: number
}

/** 草稿的內容是表單狀態，形狀不保證（舊版本、寫到一半）：只撿看得出來的照片 id */
function attachmentIdsOf(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return []
  const attachments = (value as { attachments?: unknown }).attachments
  if (!Array.isArray(attachments)) return []
  return attachments.flatMap((a) => (typeof a === 'object' && a !== null && typeof (a as { id?: unknown }).id === 'string' ? [(a as { id: string }).id] : []))
}

/**
 * 啟動時的清理（task#118、task#89）。刪除原本只是蓋上 deletedAt，資料永遠留在 IndexedDB 裡：
 *
 * 1. 刪掉超過寬限期的旅程整趟移除——旅程本身、它的支出、轉帳，以及它底下路由的草稿（不留墓碑，使用者決定）
 * 2. 刪掉超過寬限期的支出與轉帳移除
 * 3. 照片以引用為準：還有支出（含寬限期內刪掉、可能被復原的）或草稿在用的留著；
 *    沒人引用、而且存進來超過寬限期的才刪。寬限期保護的是「剛拍、草稿還沒寫進去」的照片
 *
 * 全部在同一個交易裡：清到一半失敗就整個不做，不會留下只刪了支出、旅程還在的狀態。
 */
export async function housekeep(name?: string, now: Date = new Date()): Promise<HousekeepingResult> {
  const cutoff = new Date(now.getTime() - GRACE_MS).toISOString()
  const expired = (deletedAt?: string) => deletedAt !== undefined && deletedAt < cutoff
  const result: HousekeepingResult = { trips: 0, expenses: 0, transfers: 0, drafts: 0, blobs: 0 }

  const db = await openTravelDb(name)
  try {
    const tx = db.transaction(['trips', 'expenses', 'transfers', 'drafts', 'blobs'], 'readwrite')
    const trips = tx.objectStore('trips')
    const expenses = tx.objectStore('expenses')
    const transfers = tx.objectStore('transfers')
    const drafts = tx.objectStore('drafts')
    const blobs = tx.objectStore('blobs')

    const goneTrips = new Set((await trips.getAll()).filter((t) => expired(t.deletedAt)).map((t) => t.id))
    for (const id of goneTrips) {
      await trips.delete(id)
      result.trips++
    }

    const keptAttachments = new Set<string>()
    for (const expense of await expenses.getAll()) {
      if (goneTrips.has(expense.tripId) || expired(expense.deletedAt)) {
        await expenses.delete(expense.id)
        result.expenses++
      } else {
        for (const a of expense.attachments) keptAttachments.add(a.id)
      }
    }
    for (const transfer of await transfers.getAll()) {
      if (goneTrips.has(transfer.tripId) || expired(transfer.deletedAt)) {
        await transfers.delete(transfer.id)
        result.transfers++
      }
    }
    for (const draft of await drafts.getAll()) {
      const tripId = /^\/trip\/([^/]+)\//.exec(draft.route)?.[1]
      if (tripId && goneTrips.has(tripId)) {
        await drafts.delete(draft.route)
        result.drafts++
      } else {
        for (const id of attachmentIdsOf(draft.value)) keptAttachments.add(id)
      }
    }

    // 先只拿 key：照片的位元組可能很大，只有沒人引用的候選才讀進來看存入時間
    for (const id of await blobs.getAllKeys()) {
      if (keptAttachments.has(id)) continue
      const row = await blobs.get(id)
      if (row && (row.savedAt === undefined || row.savedAt < cutoff)) {
        await blobs.delete(id)
        result.blobs++
      }
    }
    await tx.done
  } finally {
    db.close()
  }
  return result
}
