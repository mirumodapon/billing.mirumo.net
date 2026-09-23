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
