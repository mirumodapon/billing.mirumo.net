export interface ProgressBarProps {
  /** 0–1。超過 1 表示超支：條子畫滿，但 aria 仍回報真實值 */
  ratio: number
  level?: 'normal' | 'warning' | 'over'
  /** 給輔助技術的說明,如「預算已用 72%」 */
  label: string
}

export function ProgressBar({ ratio, level = 'normal', label }: ProgressBarProps) {
  const pct = Math.round(ratio * 100)
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${pct}%`}
      className="bi-progress"
    >
      <span
        data-testid="progress-fill"
        className="bi-progress__fill"
        data-level={level}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
