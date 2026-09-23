import { decimalsOf, toMinor } from './money'
import type { LineItem, OverflowRule } from './types'

/**
 * 依 memberOrder 的順序排序 id。
 * memberOrder 中沒有的 id 排在最後，並維持原本的相對順序。
 * 分攤的餘數分配依賴這個順序，所以它必須是穩定且可重現的。
 */
export function sortByMemberOrder(ids: string[], memberOrder: string[]): string[] {
  const rank = new Map(memberOrder.map((id, i) => [id, i]))
  return [...ids].sort((x, y) => {
    const rx = rank.get(x) ?? Number.MAX_SAFE_INTEGER
    const ry = rank.get(y) ?? Number.MAX_SAFE_INTEGER
    return rx - ry
  })
}

/**
 * 均分。participants 必須已依 memberOrder 排序。
 * 除不盡的餘數依序分配 1 個最小單位給前面的人，保證加總恆等於 totalMinor。
 */
export function splitEven(
  totalMinor: number,
  participants: string[],
): Record<string, number> {
  const k = participants.length
  if (k === 0) return {}

  const sign = totalMinor < 0 ? -1 : 1
  const abs = Math.abs(totalMinor)
  const base = Math.floor(abs / k)
  const remainder = abs - base * k

  const out: Record<string, number> = {}
  participants.forEach((id, i) => {
    out[id] = sign * (base + (i < remainder ? 1 : 0))
  })
  return out
}

/**
 * 把 shares 的加總硬拉到 targetMinor，差額依 memberOrder 逐一 ±1 最小單位。
 *
 * 這是核心不變量的最後一道守門：無論上游怎麼取整，離開這個函式時
 * `sum(shares) === targetMinor` 必然成立。
 */
export function reconcile(
  shares: Record<string, number>,
  targetMinor: number,
  memberOrder: string[],
): Record<string, number> {
  const out = { ...shares }
  const ids = sortByMemberOrder(Object.keys(out), memberOrder)
  if (ids.length === 0) return out

  // 差額的分配規則跟均分完全一樣：每人先拿商，餘數依 memberOrder 給前面的人。
  // 所以直接交給 splitEven，不要自己逐一 ±1 繞圈——那是 O(|diff|)，
  // 在 splitExact 收到損壞或匯入的資料而差額很大時會讓整個 App 凍住。
  const current = ids.reduce((acc, id) => acc + (out[id] ?? 0), 0)
  const spread = splitEven(targetMinor - current, ids)
  for (const id of ids) {
    out[id] = (out[id] ?? 0) + (spread[id] ?? 0)
  }
  return out
}

/**
 * 指定金額分攤。amounts 的值是**原始幣別**金額。
 *
 * 逐筆換算後各自取整，加總不保證等於 totalMinor（誤差會累積），
 * 所以最後一定要過 reconcile。UI 層已擋掉「加總 ≠ 總額」的輸入，
 * 這裡處理的純粹是換算取整的 ±1 級誤差。
 */
export function splitExact(
  amounts: Record<string, number>,
  exchangeRate: number,
  totalMinor: number,
  baseCurrency: string,
  memberOrder: string[],
): Record<string, number> {
  const entries = Object.entries(amounts)
  if (entries.length === 0) return {}

  const decimals = decimalsOf(baseCurrency)
  const shares: Record<string, number> = {}
  for (const [id, amount] of entries) {
    shares[id] = toMinor(amount * exchangeRate, decimals)
  }
  return reconcile(shares, totalMinor, memberOrder)
}

/**
 * 把差額攤回既有的 shares。
 *
 * - `prorata`：按各人現有分攤額的比例分配。服務費、稅、折價券都隨消費金額成長，
 *   按比例才公平。用最大餘數法確保加總精確且結果可重現。
 * - `even`：全員均分。適合停車費這類與消費額無關的附加費用。
 *
 * 所有 shares 皆為 0 時無法按比例分配（會除以零），退回均分。
 */
export function distribute(
  shares: Record<string, number>,
  diffMinor: number,
  rule: OverflowRule,
  memberOrder: string[],
): Record<string, number> {
  const out = { ...shares }
  if (diffMinor === 0) return out

  const ids = sortByMemberOrder(Object.keys(out), memberOrder)
  if (ids.length === 0) return out

  const total = ids.reduce((acc, id) => acc + (out[id] ?? 0), 0)

  if (rule === 'even' || total === 0) {
    const even = splitEven(diffMinor, ids)
    for (const id of ids) out[id] = (out[id] ?? 0) + (even[id] ?? 0)
    return out
  }

  // 最大餘數法：先取整數部分，再把剩下的單位依小數部分由大到小分配
  const exact = ids.map((id) => ({ id, value: ((out[id] ?? 0) / total) * diffMinor }))
  const floored = exact.map((e) => ({ ...e, whole: Math.trunc(e.value), frac: Math.abs(e.value - Math.trunc(e.value)) }))

  let assigned = floored.reduce((acc, e) => acc + e.whole, 0)
  const step = diffMinor > 0 ? 1 : -1
  const byFrac = [...floored].sort((x, y) => y.frac - x.frac)

  let i = 0
  while (assigned !== diffMinor) {
    const target = byFrac[i % byFrac.length]!
    target.whole += step
    assigned += step
    i += 1
  }

  for (const e of floored) out[e.id] = (out[e.id] ?? 0) + e.whole
  return out
}

/**
 * 明細分帳：每個品項在自己的參與者之間均分，累加後把差額攤回。
 *
 * 差額 = 實付總額 − 明細小計。收據上的品項小計與實付金額之間夾著
 * 服務費、稅、折價券、湊整，硬性要求相等會讓使用者第一次用就卡住。
 */
export function splitByItems(
  items: LineItem[],
  overflowRule: OverflowRule,
  exchangeRate: number,
  totalMinor: number,
  baseCurrency: string,
  memberOrder: string[],
): Record<string, number> {
  if (items.length === 0) return {}

  const decimals = decimalsOf(baseCurrency)
  const shares: Record<string, number> = {}

  for (const item of items) {
    const itemMinor = toMinor(item.amount * exchangeRate, decimals)
    const ordered = sortByMemberOrder(item.participants, memberOrder)
    const itemShares = splitEven(itemMinor, ordered)
    for (const [id, value] of Object.entries(itemShares)) {
      shares[id] = (shares[id] ?? 0) + value
    }
  }

  if (Object.keys(shares).length === 0) return {}

  const subtotal = Object.values(shares).reduce((x, y) => x + y, 0)
  const withDiff = distribute(shares, totalMinor - subtotal, overflowRule, memberOrder)
  // 這一步目前是 no-op，而且沒有任何輸入能讓它不是：distribute 保證恰好加上
  // `totalMinor - subtotal`，所以加總必然已經等於 totalMinor。留著是為了在
  // distribute 日後被改動時仍守住不變量——但不要把它當成這條路徑的保證來源，
  // 真正的保證在 distribute 自己。因此也沒有測試能覆蓋這一行。
  return reconcile(withDiff, totalMinor, memberOrder)
}
