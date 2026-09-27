import type { ReactNode } from 'react'

export interface PageTransitionProps {
  /** 每個路由一個穩定的值。它同時是 React key，換值就重播動畫 */
  routeKey: string
  /** forward 由右滑入，back 由左滑回；up 由下推入（全螢幕表單），down 是它的反向 */
  direction: 'forward' | 'back' | 'up' | 'down'
  children: ReactNode
}

/**
 * 刻意不依賴任何 router。Plan 6 才會決定路由層長什麼樣，現在猜它的形狀
 * 只會猜錯；這裡只要求呼叫端給一個穩定的 routeKey 與一個方向。
 */
export function PageTransition({ routeKey, direction, children }: PageTransitionProps) {
  return (
    <div key={routeKey} data-testid="page" className="bi-page" data-direction={direction}>
      {children}
    </div>
  )
}
