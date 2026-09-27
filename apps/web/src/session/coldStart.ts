import type { Trip } from '@billing/core'
import { clearSession } from '../data/session'
import type { SessionState } from '../data/types'

/** 旅程路由一定是 /trip/:id/<tab>；只有 id 沒有 tab 的殘缺路由不算 */
const TRIP_ROUTE = /^\/trip\/([^/]+)\//

export function tripIdOf(route: string): string | undefined {
  return TRIP_ROUTE.exec(route)?.[1]
}

/**
 * 冷啟動第 1 步（規格 7.9）：網址沒指定路由時改用 session 的路由。
 * 回傳要設定的 hash（不含 #），或 null 表示維持網址原樣。
 *
 * 在 React 掛載前同步呼叫，第一次繪製就是正確的頁面，不會先閃過旅程列表。
 */
export function initialHash(currentHash: string, session: SessionState | null): string | null {
  const named = currentHash.replace(/^#/, '')
  if (named && named !== '/') return null
  return session?.route && session.route !== '/' ? session.route : null
}

/**
 * 冷啟動第 2–3 步：session 指向的旅程還在嗎？
 * 不在就清掉 session，回傳要改去的路由；在或不是旅程路由則回傳 null。
 */
export async function validateSession(
  route: string,
  openTrip: (id: string) => Promise<Trip | undefined>,
): Promise<string | null> {
  const id = tripIdOf(route)
  if (!id) return null
  if (await openTrip(id)) return null
  clearSession()
  return '/'
}
