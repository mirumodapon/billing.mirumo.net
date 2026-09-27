/** 用量達到配額的這個比例就警示（規格 7.4） */
export const NEARLY_FULL = 0.8

type StorageManagerLike = Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>

function manager(): StorageManagerLike | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

/**
 * 要求瀏覽器不要清掉這個網站的資料（規格 7.4）。建立第一個旅程時呼叫。
 *
 * 對 Android/Chrome 有效；iOS Safari 只有「加到主畫面」才能免於 7 天清除，
 * 這個呼叫在那裡什麼都不保證。不支援或失敗時回 false，不拋錯。
 */
export async function requestPersistence(storage: StorageManagerLike | undefined = manager()): Promise<boolean> {
  try {
    if (!storage?.persist) return false
    if (await storage.persisted?.()) return true
    return await storage.persist()
  } catch {
    return false
  }
}

export interface StorageStatus {
  usage: number
  quota: number
  ratio: number
  nearlyFull: boolean
}

/** 設定頁顯示的用量。瀏覽器不提供估計值時回 null */
export async function storageStatus(storage: StorageManagerLike | undefined = manager()): Promise<StorageStatus | null> {
  try {
    const estimate = await storage?.estimate?.()
    if (!estimate?.quota) return null
    const usage = estimate.usage ?? 0
    const ratio = usage / estimate.quota
    return { usage, quota: estimate.quota, ratio, nearlyFull: ratio >= NEARLY_FULL }
  } catch {
    return null
  }
}
