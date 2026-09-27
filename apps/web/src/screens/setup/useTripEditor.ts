import type { Trip } from '@billing/core'
import { useParams } from 'react-router'
import { useStores, useTrips } from '../../stores/StoresProvider'

/**
 * 設定 tab 各區塊共用：當前旅程、一個只改自己欄位的存檔函式，以及這趟有沒有帳目。
 * 存檔走 tripStore.saveTrip（樂觀更新）；MemberInUseError 會從這裡原樣拋出。
 */
export function useTripEditor() {
  const { tripId = '' } = useParams()
  const { trips } = useStores()
  const trip = useTrips((s) => s.trips.find((t) => t.id === tripId))
  // Plan 6 D3：有任何未刪除的支出或轉帳就鎖本位幣
  const hasRecords = useTrips(
    (s) =>
      s.current?.tripId === tripId &&
      (s.current.expenses.some((e) => !e.deletedAt) || s.current.transfers.some((x) => !x.deletedAt)),
  )
  const save = (change: (t: Trip) => Trip) => {
    // 以 store 裡最新的那一筆為底：連續兩個欄位失焦時，第二次存檔不能蓋掉第一次的變更
    const latest = trips.getState().trips.find((t) => t.id === tripId)
    return latest ? trips.getState().saveTrip(change(latest)) : Promise.resolve(undefined)
  }
  return { trip, save, hasRecords }
}
