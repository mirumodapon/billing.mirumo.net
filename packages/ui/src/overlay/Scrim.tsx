export interface ScrimProps {
  /** 給了才可以點背景關閉。不給仍然擋住底下的點擊 */
  onDismiss?: () => void
}

export function Scrim({ onDismiss }: ScrimProps) {
  // 擋住底下的點擊靠的是 CSS 的 position: fixed + inset: 0 + z-index，
  // 不是事件處理器——一層蓋滿畫面的元素本來就會攔下指標事件。
  // 原本這裡對不可關閉的情況掛了一個空的 onClick，那是沒有作用的。
  return <div data-testid="scrim" className="bi-scrim" aria-hidden="true" onClick={onDismiss} />
}
