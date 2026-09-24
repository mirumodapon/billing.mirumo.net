/**
 * 實務用的小數位數。
 * 注意 TWD 刻意設為 0——ISO 4217 定義為 2，但台灣日常不用角分，
 * 顯示 NT$ 798 比 NT$ 798.00 自然，餘數分配單位也變成使用者看得懂的 1 元。
 */
export const CURRENCY_DECIMALS: Record<string, number> = {
  TWD: 0, JPY: 0, KRW: 0, VND: 0, IDR: 0,
  USD: 2, EUR: 2, GBP: 2, CNY: 2, HKD: 2,
  SGD: 2, THB: 2, MYR: 2, PHP: 2, AUD: 2, CAD: 2,
}

export function decimalsOf(currency: string): number {
  return CURRENCY_DECIMALS[currency] ?? 2
}

/**
 * 十進位金額 → 最小單位整數。**全專案唯一的取整入口。**
 *
 * `toPrecision(12)` 先把二進位表示誤差抹掉再取整：
 * `1.005 * 100` 在 IEEE 754 下是 `100.49999999999999`，直接 Math.round 會得到 100；
 * 先取 12 位有效數字變成 `100.500000000` 後再 round 才得到正確的 101。
 * 12 位足以涵蓋記帳的金額範圍，又低於 double 的 ~15–17 位精度極限。
 * 實測上限約 1e12 個最小單位（兩位小數幣別的百億元）——再上去會開始失準，
 * 例如 toMinor(12345678901.23, 2) 會差 3。單趟旅行構不到這個量級。
 * 實測上限：約 1e12 最小單位（兩位小數幣別的百億元）以上會開始失準，
 * 例如 toMinor(12345678901.23, 2) 會差 3。單趟旅行構不到。
 */
export function toMinor(value: number, decimals: number): number {
  return Math.round(Number((value * 10 ** decimals).toPrecision(12)))
}

/**
 * 最小單位整數 → 十進位金額。回傳原始浮點數，刻意不取整。
 *
 * 從這裡衍生出來的浮點數若要變回最小單位，**必須走回 `toMinor`**，
 * 不可以在別處另開 `Math.round` 或 `toFixed`——那會是第二條取整路徑，
 * 而「金額對不上」的 bug 就會多一個藏身處。
 */
export function fromMinor(minor: number, decimals: number): number {
  return minor / 10 ** decimals
}

/**
 * 原始幣別金額 × 匯率 → 本位幣最小單位整數。
 *
 * 這是全專案唯一的換算入口，所以非有限數的守衛放在這裡就夠了。
 * 沒有它的話 NaN 會一路傳到最糟的地方：每個人的淨額都是 NaN，而
 * `NaN > 0` 與 `NaN < 0` 同時為 false，於是最少轉帳回傳空陣列，
 * 結算畫面在資料全壞的情況下顯示「大家都結清了」。
 * 寧可在來源大聲失敗，也不要在終點給出自信的錯誤答案。
 */
export function convertToBaseMinor(
  amount: number,
  exchangeRate: number,
  baseCurrency: string,
): number {
  if (!Number.isFinite(amount) || !Number.isFinite(exchangeRate)) {
    throw new Error(
      `convertToBaseMinor: amount and exchangeRate must be finite, got ${amount} and ${exchangeRate}`,
    )
  }
  return toMinor(amount * exchangeRate, decimalsOf(baseCurrency))
}
