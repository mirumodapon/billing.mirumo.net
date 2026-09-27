const clean = (n: number) => Number(n.toPrecision(12))

/**
 * 從 0 到 max 的乾淨刻度：步距取 1 / 2 / 5 乘以十的次方，約 targetTicks 格。
 */
export function niceScale(max: number, targetTicks = 4): { max: number; ticks: number[] } {
  if (!(max > 0)) return { max: 1, ticks: [0] }
  const rough = max / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  // 先壓雜訊再減一個極小值才 ceil：除法結果落在整數上方一點點時
  // （如 2.0000000000000004），直接 ceil 會多出一整格空刻度
  const count = Math.ceil(clean(max / step) - 1e-9)
  const top = clean(count * step)
  return { max: top, ticks: Array.from({ length: count + 1 }, (_, i) => clean(i * step)) }
}

const round = (n: number) => Math.round(n * 1000) / 1000

/**
 * 頂端圓角、底部方角的柱。圓角不超過柱高與柱寬的一半，
 * 矮到比圓角還小的柱才不會往基線下方凸出去。
 */
export function barPath(x: number, width: number, top: number, base: number, radius = 4): string {
  const height = base - top
  if (height <= 0) return ''
  const r = Math.min(radius, height, width / 2)
  const [x0, x1, t, b] = [x, x + width, top, base].map(round) as [number, number, number, number]
  return [
    `M ${x0} ${b}`,
    `L ${x0} ${round(t + r)}`,
    `Q ${x0} ${t} ${round(x0 + r)} ${t}`,
    `L ${round(x1 - r)} ${t}`,
    `Q ${x1} ${t} ${x1} ${round(t + r)}`,
    `L ${x1} ${b} Z`,
  ].join(' ')
}
