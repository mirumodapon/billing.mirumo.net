import type { HTMLAttributes, Ref } from 'react'

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'> {
  variant?: 'text' | 'circle' | 'rect'
  width?: string
  height?: string
  /** 畫幾行，只對 text 有意義 */
  lines?: number
  ref?: Ref<HTMLSpanElement>
}

export function Skeleton({ variant = 'text', width, height, lines = 1, ref, ...rest }: SkeletonProps) {
  const count = variant === 'text' ? Math.max(1, lines) : 1
  return (
    // 透傳的屬性先展開，元件自己的放後面：骨架對輔助技術必須一直是隱藏的
    <span {...rest} ref={ref} data-testid="skeleton" aria-hidden="true" className="bi-skeleton" data-variant={variant}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} data-testid="skeleton-line" className="bi-skeleton__line" style={{ width, height }} />
      ))}
    </span>
  )
}
