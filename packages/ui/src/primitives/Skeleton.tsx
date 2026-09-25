export interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect'
  width?: string
  height?: string
  /** 畫幾行，只對 text 有意義 */
  lines?: number
}

export function Skeleton({ variant = 'text', width, height, lines = 1 }: SkeletonProps) {
  const count = variant === 'text' ? Math.max(1, lines) : 1
  return (
    <span data-testid="skeleton" aria-hidden="true" className="bi-skeleton" data-variant={variant}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} data-testid="skeleton-line" className="bi-skeleton__line" style={{ width, height }} />
      ))}
    </span>
  )
}
