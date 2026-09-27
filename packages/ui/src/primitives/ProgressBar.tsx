import type { HTMLAttributes, Ref } from 'react'

// aria-label 由 ariaLabel 負責，不留兩個入口
export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children' | 'aria-label'> {
  /** 0–1。超過 1 表示超支：條子畫滿，但 aria 仍回報真實值 */
  ratio: number
  /** 用 core 的 budgetStatus().level：門檻是業務規則，這裡不推導 */
  level: 'normal' | 'warning' | 'over'
  /** 給輔助技術的說明,如「預算已用 72%」 */
  ariaLabel: string
  ref?: Ref<HTMLDivElement>
}

export function ProgressBar({ ratio, level, ariaLabel, ref, ...rest }: ProgressBarProps) {
  // NaN（預算沒設定時的 0/0）沒有數值可報：照 ARIA 的不確定進度條，不帶 valuenow
  const known = !Number.isNaN(ratio)
  const pct = Math.round(ratio * 100)
  const clamped = known ? Math.min(100, Math.max(0, pct)) : 0
  return (
    // 透傳的屬性先展開：role 與數值屬性都是從 ratio 算出來的，不能被蓋掉
    <div
      {...rest}
      ref={ref}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={known ? clamped : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      // Infinity（預算為 0 卻有花費）條子照樣畫滿，但「Infinity%」不是能念給人聽的數字
      aria-valuetext={Number.isFinite(pct) ? `${pct}%` : undefined}
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
