import { useEffect } from 'react'
import { useStores, useTrips } from '../stores/StoresProvider'

/**
 * 確保這趟旅程的支出與轉帳已載入（規格 7.5：進入旅程時才載）。
 *
 * 只負責載入、不負責清掉：旅程頁與全螢幕表單都用它，兩者之間切換時不該
 * 先清再載。回到旅程列表時由列表清掉（TripListScreen）。回傳資料是否就緒。
 */
export function useOpenTrip(tripId: string): boolean {
  const { trips } = useStores()
  const ready = useTrips((s) => s.current?.tripId === tripId)
  useEffect(() => {
    // 讀當下的狀態而不是 render 時的值：StrictMode 的模擬卸載之後重新執行時，
    // render 時的值可能已經過時
    if (trips.getState().current?.tripId !== tripId) void trips.getState().openTrip(tripId)
  }, [trips, tripId])
  return ready
}
