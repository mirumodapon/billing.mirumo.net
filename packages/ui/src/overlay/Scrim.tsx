export interface ScrimProps {
  /** 給了才可以點背景關閉。不給仍然擋住底下的點擊 */
  onDismiss?: () => void
}

export function Scrim({ onDismiss }: ScrimProps) {
  return (
    <div
      data-testid="scrim"
      className="bi-scrim"
      aria-hidden="true"
      // 不可關閉時仍掛一個空的 onClick：沒有它的話點擊會穿透到底下
      // 被遮住的元素，使用者會點到自己看不見的東西
      onClick={onDismiss ?? (() => {})}
    />
  )
}
