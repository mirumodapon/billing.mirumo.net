import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { readSession, writeSession } from '../data/session'
import type { SessionState } from '../data/types'
import { tripIdOf } from './coldStart'

/**
 * 路由一變就寫進 session（規格 7.9「路由變更 → 立即寫 session」）。
 *
 * 只換 route 與 tripId，其餘欄位（捲動位置、收折狀態）原樣保留。
 * enabled 為 false 時不寫：冷啟動驗證完成前的暫時路由不能蓋掉它要驗證的 session。
 */
export function useSessionSync(enabled = true): void {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!enabled) return
    const next: SessionState = { ...readSession(), route: pathname }
    const tripId = tripIdOf(pathname)
    if (tripId) next.tripId = tripId
    else delete next.tripId
    writeSession(next)
  }, [enabled, pathname])
}
