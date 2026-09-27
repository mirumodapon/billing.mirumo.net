import { useState } from 'react'
import { barPath, niceScale } from './barMath'

export interface BarDatum {
  key: string
  /** x 軸標籤，如「3/15」 */
  label: string
  value: number
}

export interface BarChartProps {
  bars: readonly BarDatum[]
  ariaLabel: string
  formatValue: (value: number) => string
  /** 刻度用的格式，預設與 formatValue 相同。貨幣符號太寬時可以給精簡版 */
  formatTick?: (value: number) => string
  /** 每日預算。給了才畫預算線、才判定超支 */
  budget?: number
  budgetLabel: string
  overBudgetLabel: string
  emptyLabel: string
  /** 繪圖區高度，px */
  plotHeight?: number
}

/** 每一天佔的欄寬與柱寬。柱不超過 24px，剩下的是柱與柱之間的呼吸 */
const SLOT = 32
const BAR = 20
/** 左側刻度標籤的寬度 */
const AXIS = 44
/** 繪圖區上方留給數值標籤的空間 */
const TOP = 20
/** 繪圖區下方留給日期標籤的空間 */
const BOTTOM = 20

export function BarChart({
  bars,
  ariaLabel,
  formatValue,
  formatTick = formatValue,
  budget,
  budgetLabel,
  overBudgetLabel,
  emptyLabel,
  plotHeight = 160,
}: BarChartProps) {
  const [selected, setSelected] = useState<string | null>(null)

  if (bars.length === 0) return <p className="bi-bar__empty">{emptyLabel}</p>

  const values = bars.map((bar) => Math.max(0, bar.value))
  const scale = niceScale(Math.max(...values, budget ?? 0))
  const width = AXIS + bars.length * SLOT
  const height = TOP + plotHeight + BOTTOM
  const base = TOP + plotHeight
  const y = (value: number) => base - (value / scale.max) * plotHeight
  // 規格說「超過」：剛好等於預算不算超支
  const isOver = (value: number) => budget !== undefined && value > budget

  return (
    <figure className="bi-bar" aria-label={ariaLabel}>
      <div className="bi-bar__scroll">
        {/* 圖形對輔助科技隱藏：同一份資料在下面的表格裡 */}
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line className="bi-bar__grid" x1={AXIS} x2={width} y1={y(tick)} y2={y(tick)} />
              <text className="bi-bar__tick" x={AXIS - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {bars.map((bar, index) => {
            const value = values[index]!
            const slotX = AXIS + index * SLOT
            const x = slotX + (SLOT - BAR) / 2
            const over = isOver(value)
            const isSelected = selected === bar.key
            return (
              <g
                key={bar.key}
                data-testid={`bar-${bar.key}`}
                data-over={over || undefined}
                data-selected={isSelected || undefined}
              >
                {/* 可點區域是整個欄位，比柱本身大 */}
                <rect
                  className="bi-bar__hit"
                  x={slotX}
                  y={TOP}
                  width={SLOT}
                  height={plotHeight}
                  onClick={() => setSelected((current) => (current === bar.key ? null : bar.key))}
                />
                <path className="bi-bar__mark" d={barPath(x, BAR, y(value), base)} />
                {/* 只標重點：超支日與被點的那一天 */}
                {over || isSelected ? (
                  <text className="bi-bar__value" x={x + BAR / 2} y={y(value) - 4} textAnchor="middle">
                    {formatValue(bar.value)}
                  </text>
                ) : null}
                <text className="bi-bar__label" x={x + BAR / 2} y={base + 14} textAnchor="middle">
                  {bar.label}
                </text>
              </g>
            )
          })}
          {/* 預算線畫在柱之後，壓在柱上面，超出的部分才看得出是露在線的上方 */}
          {budget !== undefined ? (
            <g data-testid="budget-line">
              <line className="bi-bar__budget" x1={AXIS} x2={width} y1={y(budget)} y2={y(budget)} />
              <text className="bi-bar__budget-label" x={width - 2} y={y(budget) - 4} textAnchor="end">
                {budgetLabel}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <table className="bi-visually-hidden">
        <caption>{ariaLabel}</caption>
        <tbody>
          {bars.map((bar, index) => (
            <tr key={bar.key}>
              <th scope="row">{bar.label}</th>
              {/*
               * 表格寫真實數值，不寫夾過的：退款多於支出的那天是負的，
               * 柱子畫不出負值所以是空的，但給輔助科技的資料不能跟著說謊寫 0
               */}
              <td>{formatValue(bar.value)}</td>
              <td>{isOver(values[index]!) ? overBudgetLabel : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
