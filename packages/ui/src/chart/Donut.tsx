import { useState } from 'react'
import { arcPath, donutArcs, percentages } from './donutMath'
import type { AccentSlot } from '../theme/accentOrder'

export interface DonutSegment {
  key: string
  label: string
  /** 金額的最小單位，整數 */
  value: number
  colorKey: AccentSlot
}

export interface DonutProps {
  segments: readonly DonutSegment[]
  label: string
  formatValue: (value: number) => string
  emptyLabel: string
  /** 中央沒有選中任何一塊時顯示的標題，如「總計」 */
  totalLabel: string
  /** 圖的邊長，px */
  size?: number
}

const CENTER = 50
const R_OUTER = 48
const R_INNER = 34
/** 相鄰段落之間的背景色間隙，px（dataviz 的 2px surface gap） */
const GAP_PX = 2

export function Donut({ segments, label, formatValue, emptyLabel, totalLabel, size = 160 }: DonutProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const drawn = segments.filter((segment) => segment.value > 0)

  if (drawn.length === 0) {
    return (
      <figure className="bi-donut" aria-label={label}>
        <div className="bi-donut__plot" style={{ width: size, height: size }}>
          <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <circle className="bi-donut__empty-ring" cx={CENTER} cy={CENTER} r={(R_OUTER + R_INNER) / 2} />
          </svg>
          <div className="bi-donut__center">
            <span className="bi-donut__center-label">{emptyLabel}</span>
          </div>
        </div>
      </figure>
    )
  }

  // 2px 換算成弧度：viewBox 100 對應 size px，取環的中線半徑
  const gap = (GAP_PX * (100 / size)) / ((R_OUTER + R_INNER) / 2)
  const arcs = donutArcs(drawn, gap)
  const shares = percentages(drawn.map((segment) => segment.value))
  const total = drawn.reduce((sum, segment) => sum + segment.value, 0)
  const active = drawn.find((segment) => segment.key === selected) ?? null
  const toggle = (key: string) => setSelected((current) => (current === key ? null : key))

  return (
    <figure className="bi-donut" aria-label={label}>
      <div className="bi-donut__plot" style={{ width: size, height: size }}>
        {/* 圖形對輔助科技隱藏：同樣的資料在下面的圖例裡以文字完整列出 */}
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          {arcs.map((arc, index) => {
            const segment = drawn[index]!
            return (
              <path
                key={segment.key}
                data-testid={`donut-segment-${segment.key}`}
                className="bi-donut__segment"
                d={arcPath(CENTER, CENTER, R_OUTER, R_INNER, arc.start, arc.end)}
                fillRule="evenodd"
                style={{ fill: `var(--bi-${segment.colorKey})` }}
                data-dim={(active !== null && active.key !== segment.key) || undefined}
                onClick={() => toggle(segment.key)}
              />
            )
          })}
        </svg>
        <div className="bi-donut__center" data-testid="donut-center" aria-live="polite">
          <span className="bi-donut__center-label">{active ? active.label : totalLabel}</span>
          <span className="bi-donut__center-value">{formatValue(active ? active.value : total)}</span>
        </div>
      </div>
      <ul className="bi-donut__legend">
        {drawn.map((segment, index) => (
          <li key={segment.key}>
            <button
              type="button"
              className="bi-donut__legend-item"
              aria-pressed={selected === segment.key}
              onClick={() => toggle(segment.key)}
            >
              <span
                className="bi-donut__swatch"
                aria-hidden="true"
                style={{ background: `var(--bi-${segment.colorKey})` }}
              />
              <span className="bi-donut__legend-label">{segment.label}</span>
              <span className="bi-donut__legend-value">{formatValue(segment.value)}</span>
              <span className="bi-donut__legend-share" data-testid="donut-share">
                {shares[index]}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  )
}
