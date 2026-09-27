/** frankfurter.app：免金鑰、支援 CORS（規格 4.7）。vite.config.ts 的 runtimeCaching 以這個前綴比對 */
export const FX_API = 'https://api.frankfurter.app'

export type FetchRateResult = { ok: true; rate: number } | { ok: false; reason: 'offline' | 'unsupported' | 'failed' }

/**
 * 1 單位 from 值多少 to。
 *
 * 從不拋錯：抓匯率只是參考，失敗時畫面說明原因、欄位維持原值，
 * 不能擋住任何流程（規格 7.6：除了抓匯率，所有功能離線完全可用）。
 */
export async function fetchRate(from: string, to: string, fetchImpl: typeof fetch = fetch): Promise<FetchRateResult> {
  if (from === to) return { ok: true, rate: 1 }
  let res: Response
  try {
    res = await fetchImpl(`${FX_API}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  } catch {
    return { ok: false, reason: 'offline' }
  }
  if (res.status === 404 || res.status === 422) return { ok: false, reason: 'unsupported' }
  if (!res.ok) return { ok: false, reason: 'failed' }
  try {
    const body: unknown = await res.json()
    const rate = (body as { rates?: Record<string, unknown> } | null)?.rates?.[to]
    return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? { ok: true, rate } : { ok: false, reason: 'failed' }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}
