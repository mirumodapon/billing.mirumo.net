import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDragDismiss } from '../hooks/useDragDismiss'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { SafeArea } from '../layout/SafeArea'
import { Scrim } from './Scrim'

export interface SheetProps {
  open: boolean
  onClose: () => void
  /** 標題列文字，同時是這個 dialog 給輔助科技的名稱 */
  title: string
  children: ReactNode
}

/** 拖過這個距離就關閉。約是一根手指舒服的下滑幅度 */
const DISMISS_THRESHOLD = 96

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const { offset, dragging, handlers } = useDragDismiss({
    axis: 'y',
    threshold: DISMISS_THRESHOLD,
    onDismiss: onClose,
  })
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose)

  if (!open) return null

  // 掛在 body 上而不是原地：sheet 必須蓋過所有東西，而原地渲染會被任何
  // 帶 transform 或 filter 的祖先困在它的堆疊脈絡裡，z-index 再高也沒用
  return createPortal(
    <>
      <Scrim onDismiss={onClose} />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bi-sheet"
        data-dragging={dragging || undefined}
        style={{ '--bi-sheet-drag': `${offset}px` } as CSSProperties}
      >
        {/* 把手本身就是拖曳區。整張 sheet 都可拖的話，裡面的捲動清單會搶不到手勢 */}
        <div className="bi-sheet__handle" {...handlers}>
          <span className="bi-sheet__grip" />
          <h2 className="bi-sheet__title">{title}</h2>
        </div>
        <SafeArea edges={['bottom']}>
          <div className="bi-sheet__body">{children}</div>
        </SafeArea>
      </div>
    </>,
    document.body,
  )
}
