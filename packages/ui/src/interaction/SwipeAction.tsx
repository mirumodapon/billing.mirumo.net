import type { TablerIcon } from '@tabler/icons-react'
import type { CSSProperties, ReactNode } from 'react'
import { useDragDismiss } from '../hooks/useDragDismiss'
import { Icon } from '../icons/Icon'

export interface SwipeActionProps {
  glyph: TablerIcon
  /** 動作的名稱，同時是按鈕的無障礙名稱 */
  actionLabel: string
  onAction: () => void
  children: ReactNode
}

/** 滑過這個距離就觸發。比 sheet 短，因為橫向空間有限 */
const SWIPE_THRESHOLD = 88

export function SwipeAction({ glyph, actionLabel, onAction, children }: SwipeActionProps) {
  const { offset, dragging, reset, handlers } = useDragDismiss({
    axis: 'x',
    threshold: SWIPE_THRESHOLD,
    // 觸發後滑回原位：動作可能先跳確認，取消時這一列還在（刪除成功時整列會消失，回不回位都看不到）
    onDismiss: () => {
      reset()
      onAction()
    },
  })

  return (
    <div className="bi-swipe">
      {/*
       * 動作鍵放在底下、被內容蓋住，滑開才露出來。它是一個真的 button，
       * 所以鍵盤與輔助科技不必會滑動也能用——手勢只是捷徑，不是唯一入口
       */}
      <button type="button" className="bi-swipe__action" onClick={onAction}>
        <Icon glyph={glyph} ariaLabel={actionLabel} />
      </button>
      <div
        data-testid="swipe-surface"
        className="bi-swipe__surface"
        data-dragging={dragging || undefined}
        style={{ '--bi-swipe-offset': `${offset}px` } as CSSProperties}
        {...handlers}
      >
        {children}
      </div>
    </div>
  )
}
