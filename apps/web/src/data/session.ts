import type { SessionState } from './types'

export const SESSION_KEY = 'bi-session'

/** 取得 localStorage。無痕模式或被封鎖時存取本身就會拋錯，所以包在函式裡 */
function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/**
 * 同步讀取上次的操作狀態（規格 7.9）。
 *
 * Session 是「資料一律進 IndexedDB」的唯一例外：冷啟動時要同步決定初始路由，
 * 等 IndexedDB 回來才決定的話，畫面會先閃過旅程列表再跳頁。
 *
 * 讀不到、格式不對、欄位型別不對一律回 null 讓 app 走預設路由，而不是拋錯——
 * 壞掉的 session 絕不能讓 app 開不起來。
 */
export function readSession(store: Storage | undefined = storage()): SessionState | null {
  try {
    const raw = store?.getItem(SESSION_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const s = value as Record<string, unknown>
    if (typeof s.route !== 'string' || !s.route.startsWith('/')) return null
    if (s.tripId !== undefined && typeof s.tripId !== 'string') return null
    if (s.statsScope !== undefined && s.statsScope !== 'self' && s.statsScope !== 'group') return null
    if (s.openAccordion !== undefined && typeof s.openAccordion !== 'string') return null
    if (s.collapsedStats !== undefined && !isStringArray(s.collapsedStats)) return null
    if (s.filters !== undefined) {
      const f = s.filters as Record<string, unknown> | null
      if (
        !f ||
        typeof f.tripId !== 'string' ||
        !isStringArray(f.categoryIds) ||
        !isStringArray(f.payers) ||
        !isStringArray(f.paymentMethodIds) ||
        typeof f.draftsOnly !== 'boolean'
      ) {
        return null
      }
    }
    if (s.scrollTop !== undefined) {
      const st = s.scrollTop as Record<string, unknown> | null
      if (!st || typeof st !== 'object' || !Object.values(st).every((n) => typeof n === 'number' && Number.isFinite(n))) return null
    }
    return value as SessionState
  } catch {
    return null
  }
}

/** 寫入失敗（配額已滿、無痕模式）靜默略過：session 是便利，不是資料 */
export function writeSession(state: SessionState, store: Storage | undefined = storage()): void {
  try {
    store?.setItem(SESSION_KEY, JSON.stringify(state))
  } catch {
    // 刻意吞掉
  }
}

export function clearSession(store: Storage | undefined = storage()): void {
  try {
    store?.removeItem(SESSION_KEY)
  } catch {
    // 刻意吞掉
  }
}
