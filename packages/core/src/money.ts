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

export function fromMinor(minor: number, decimals: number): number {
  return minor / 10 ** decimals
}

/** 原始幣別金額 × 匯率 → 本位幣最小單位整數 */
export function convertToBaseMinor(
  amount: number,
  exchangeRate: number,
  baseCurrency: string,
): number {
  return toMinor(amount * exchangeRate, decimalsOf(baseCurrency))
}
