import { convertToBaseMinor, decimalsOf, toMinor } from './money'
import type { Expense, LineItem, OverflowRule } from './types'

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

  // 最大餘數法：先取整數部分，再把剩下的單位依餘數由大到小分配。
  //
  // 餘數一律用整數算（numerator - whole × total），不要用小數部分比大小。
  // `(share / total) * diffMinor` 會帶進表示誤差：以 {a:4,b:1,c:1} 攤 −200 為例，
  // 三人的精確餘數相等、該由 memberOrder 決勝，但浮點讓 b 與 c 的小數部分大了
  // 約 1e-14，於是決勝依據從成員順序變成了表示誤差，結果不再可重現。
  // 先乘後除也擋不住——比較本身必須離開浮點。
  //
  // 前提：|share × diffMinor| < 2^53。超過的話 numerator 本身就不精確，
  // 整數比較的保證跟著失效。實務上兩者都要達到千萬級才會撞到，單筆收據不可能，
  // 但若日後拿掉金額上限，這裡要重新檢查。
  // 權重取絕對值。混正負的 shares（收據上同時有商品與退貨/優惠券）下，
  // Math.trunc 朝零取整會把負項往上抬，讓 assigned 越過 diffMinor，而 step
  // 仍朝原方向走——迴圈就再也回不到終止條件，整個 App 同步凍結。
  // 用 |share| 當權重後，每個 value 都與 diffMinor 同號，|Σ trunc| ≤ |diffMinor|，
  // step 必然朝目標前進。shares 全正或全負時結果與先前完全相同。
  const weights = ids.map((id) => Math.abs(out[id] ?? 0))
  const weightTotal = weights.reduce((acc, w) => acc + w, 0)

  const rows = ids.map((id, index) => {
    const numerator = (weights[index] ?? 0) * diffMinor
    const whole = Math.trunc(numerator / weightTotal)
    return { id, whole, remainder: Math.abs(numerator - whole * weightTotal) }
  })

  let assigned = rows.reduce((acc, e) => acc + e.whole, 0)
  const step = diffMinor > 0 ? 1 : -1
  // 穩定排序：餘數相同時維持 memberOrder 的先後，前面的人先拿
  const byRemainder = [...rows].sort((x, y) => y.remainder - x.remainder)

  // 上界：每個 trunc 損失不到一單位，所以最多補 ids.length 次。多留一輪的餘裕，
  // 超過就是前提被破壞了（非整數或 NaN 的 diffMinor），寧可拋錯也不要卡住。
  const maxSteps = rows.length + 1
  let i = 0
  while (assigned !== diffMinor) {
    if (i >= maxSteps) {
      throw new Error(
        `distribute: cannot reach ${diffMinor} from ${assigned} in ${maxSteps} steps; ` +
          'diffMinor and shares must be finite integers',
      )
    }
    const target = byRemainder[i % byRemainder.length]!
    target.whole += step
    assigned += step
    i += 1
  }

  for (const e of rows) out[e.id] = (out[e.id] ?? 0) + e.whole
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

/**
 * 一筆支出的各人分攤額（本位幣最小單位整數）。
 *
 * 三種模式最後都收斂到同一個輸出，且 **加總恆等於該筆的本位幣總額**。
 * settle 與 stats 只透過這個函式取得分攤，不需要知道模式的差異。
 *
 * 分攤設定是空的（沒有參與者、沒有金額、沒有品項）時，全額歸付款人。
 * 那是型別合法但無意義的狀態——UI 不該產生，匯入的備份卻可能帶進來。
 * 回傳空物件會讓這筆錢從結算裡消失、Σ net 不再為零；歸給付款人則語意清楚
 * （「我付了但沒人跟我分」）、不變量保住，使用者也看得到那筆帳而能自行修正。
 */
export function sharesOf(
  expense: Expense,
  baseCurrency: string,
  memberOrder: string[],
): Record<string, number> {
  const totalMinor = convertToBaseMinor(expense.amount, expense.exchangeRate, baseCurrency)
  const shares = splitOf(expense, totalMinor, baseCurrency, memberOrder)
  return Object.keys(shares).length === 0 ? { [expense.paidBy]: totalMinor } : shares
}

function splitOf(
  expense: Expense,
  totalMinor: number,
  baseCurrency: string,
  memberOrder: string[],
): Record<string, number> {
  const { split } = expense

  switch (split.mode) {
    case 'even':
      return splitEven(totalMinor, sortByMemberOrder(split.participants, memberOrder))
    case 'exact':
      return splitExact(split.amounts, expense.exchangeRate, totalMinor, baseCurrency, memberOrder)
    case 'items':
      return splitByItems(
        split.items,
        split.overflowRule,
        expense.exchangeRate,
        totalMinor,
        baseCurrency,
        memberOrder,
      )
  }
}
