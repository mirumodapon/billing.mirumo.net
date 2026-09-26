import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { SafeArea } from '../layout/SafeArea'

export interface SnackbarProps {
  open: boolean
  message: string
  /** 有 actionLabel 才會顯示動作鍵，通常是「復原」 */
  actionLabel?: string
  onAction?: () => void
  /** 倒數多久後自動消失 */
  durationMs?: number
  onDismiss: () => void
}

/** 四秒：夠讀完一行字並決定要不要復原，又不會擋住畫面太久 */
const DEFAULT_DURATION = 4000

export function Snackbar({
  open,
  message,
  actionLabel,
  onAction,
  durationMs = DEFAULT_DURATION,
  onDismiss,
}: SnackbarProps) {
  useEffect(() => {
    if (!open) return
    const id = setTimeout(onDismiss, durationMs)
    // 收掉計時器不是禮貌問題：留著的話使用者按了復原之後，舊的計時器
    // 仍會在幾秒後觸發 onDismiss，而呼叫端多半把它當成「確定刪除」的時機
    return () => clearTimeout(id)
    // message 進相依陣列，所以第二則訊息會重新倒數，而不是繼承前一則剩下的時間
  }, [open, message, durationMs, onDismiss])

  if (!open) return null

  return createPortal(
    <SafeArea edges={['bottom', 'left', 'right']} data-testid="snackbar-safe">
      <div role="status" className="bi-snackbar">
        <span className="bi-snackbar__message">{message}</span>
        {actionLabel ? (
          <button
            type="button"
            className="bi-snackbar__action"
            onClick={() => {
              onAction?.()
              onDismiss()
            }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </SafeArea>,
    document.body,
  )
}
