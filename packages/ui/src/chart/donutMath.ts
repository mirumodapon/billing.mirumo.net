const TAU = Math.PI * 2

export interface ArcSpan {
  key: string
  /** 弧度，0 在十二點鐘方向，順時針遞增 */
  start: number
  end: number
}

/** 極小的一塊仍然要畫得出來，至少佔這麼多弧度 */
const MIN_SPAN = 0.001

/**
 * 把數值換成弧段。相鄰弧段之間留 gap 弧度的空隙，第一段從 gap/2 開始，
 * 最後一段結束在 TAU - gap/2，所以首尾之間也是一個完整的 gap。
 * 零與負值不畫。
 */
export function donutArcs(items: readonly { key: string; value: number }[], gap: number): ArcSpan[] {
  const positive = items.filter((item) => item.value > 0)
  const total = positive.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) return []
  // 只有一塊時畫完整的圓：留一個缺口會讓人以為少了一類
  if (positive.length === 1) return [{ key: positive[0]!.key, start: 0, end: TAU }]

  let cursor = 0
  return positive.map((item) => {
    const span = (item.value / total) * TAU
    const start = cursor + gap / 2
    const end = Math.max(start + MIN_SPAN, cursor + span - gap / 2)
    cursor += span
    return { key: item.key, start, end }
  })
}

const round = (n: number) => Math.round(n * 1000) / 1000

/** 環形扇區的路徑。整圈時拆成兩個半圓，因為起終點重合的單一弧畫不出來 */
export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
): string {
  const point = (r: number, angle: number) =>
    `${round(cx + r * Math.sin(angle))} ${round(cy - r * Math.cos(angle))}`

  if (end - start >= TAU - 1e-9) {
    return [
      `M ${point(rOuter, 0)}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${point(rOuter, Math.PI)}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${point(rOuter, 0)}`,
      `M ${point(rInner, 0)}`,
      `A ${rInner} ${rInner} 0 1 0 ${point(rInner, Math.PI)}`,
      `A ${rInner} ${rInner} 0 1 0 ${point(rInner, 0)}`,
      'Z',
    ].join(' ')
  }

  const large = end - start > Math.PI ? 1 : 0
  return [
    `M ${point(rOuter, start)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${point(rOuter, end)}`,
    `L ${point(rInner, end)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${point(rInner, start)}`,
    'Z',
  ].join(' ')
}

/**
 * 整數百分比，加總恰好 100（最大餘數法）。
 *
 * 輸入預期是金額的最小單位，也就是整數，所以餘數用整數比較——浮點數的
 * 雜訊會讓平手的順序取決於表示誤差，而不是原本的順序。
 */
export function percentages(values: readonly number[]): number[] {
  const clean = values.map((v) => Math.max(0, Math.round(v)))
  const total = clean.reduce((sum, v) => sum + v, 0)
  if (total === 0) return clean.map(() => 0)

  const rows = clean.map((v, index) => {
    const whole = Math.floor((v * 100) / total)
    return { index, whole, remainder: v * 100 - whole * total }
  })
  let left = 100 - rows.reduce((sum, row) => sum + row.whole, 0)
  const order = [...rows].sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const row of order) {
    if (left === 0) break
    row.whole += 1
    left -= 1
  }
  return rows.map((row) => row.whole)
}
