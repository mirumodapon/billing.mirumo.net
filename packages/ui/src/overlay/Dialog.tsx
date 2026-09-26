import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { Button } from '../primitives/Button'
import { Scrim } from './Scrim'

export interface DialogProps {
  open: boolean
  title: string
  /** 補充說明，通常講清楚這個動作的後果 */
  description?: string
  confirmLabel: string
  cancelLabel: string
  /** 確認鍵用 danger 樣式。刪除、清空這類做了就回不去的動作要開 */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function Dialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: DialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open, onCancel)

  if (!open) return null

  return createPortal(
    <>
      {/* 不傳 onDismiss：點背景不關閉，但仍然擋住底下的點擊 */}
      <Scrim />
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={title} className="bi-dialog">
        <h2 className="bi-dialog__title">{title}</h2>
        {description ? <p className="bi-dialog__desc">{description}</p> : null}
        <div className="bi-dialog__actions">
          {/*
           * 取消放前面，所以焦點陷阱會先落在它身上。誤觸的成本不對稱：
           * 多按一次確認只是麻煩，誤刪要重新輸入整筆資料。
           */}
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  )
}
