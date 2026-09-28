import type { TripRepository } from './tripRepository'

/**
 * 清除這台裝置上的所有本機資料（task#133）：資料庫裡的一切（見 TripRepository.clearAll），
 * 以及 localStorage／sessionStorage 裡的畫面狀態、備份提醒與錯誤記錄。
 */
export async function clearAllData(repo: Pick<TripRepository, 'clearAll'>): Promise<void> {
  await repo.clearAll()
  for (const storage of [() => globalThis.localStorage, () => globalThis.sessionStorage]) {
    // 無痕模式或被封鎖時存取本身就會拋錯：資料庫已經清掉了，這裡清不到也不算失敗
    try {
      storage().clear()
    } catch {
      /* 見上 */
    }
  }
}

/** 清除之後從旅程清單重新開始：每個 store 重新從空的資料庫載入 */
export function restartApp(): void {
  location.hash = '#/'
  location.reload()
}
