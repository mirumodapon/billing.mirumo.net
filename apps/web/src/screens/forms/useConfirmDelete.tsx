import { Dialog } from '@billing/ui'
import { useState, type ReactNode } from 'react'
import { useI18n } from '../../i18n/useI18n'

/**
 * 刪除之後還能怎樣，決定對話框底下那句說明：
 * - undoable：軟刪除，snackbar 可以復原（旅程、支出、轉帳）
 * - permanent：直接改設定，沒有復原（類別、付款方式、成員、匯率）
 * - form：只從表單移除，要按儲存才生效（收據照片、明細品項），不另外說明
 */
export type DeleteKind = 'undoable' | 'permanent' | 'form'

interface Pending {
  name: string
  kind: DeleteKind
  run: () => void
}

/**
 * 每一種刪除都先跳確認（使用者要求，取代規格 4.2「不跳確認、只靠復原」）。
 * `ask` 開對話框，`dialog` 放進畫面裡一次；確認才執行，取消什麼都不做。
 */
export function useConfirmDelete(): { ask: (name: string, kind: DeleteKind, run: () => void) => void; dialog: ReactNode } {
  const { t } = useI18n()
  const [pending, setPending] = useState<Pending | null>(null)
  const description = pending?.kind === 'undoable' ? t('confirm.undoable') : pending?.kind === 'permanent' ? t('confirm.permanent') : undefined

  const dialog = (
    <Dialog
      open={pending !== null}
      title={t('confirm.deleteTitle', { name: pending?.name ?? '' })}
      description={description}
      confirmLabel={t('common.delete')}
      cancelLabel={t('common.cancel')}
      destructive
      onConfirm={() => {
        const run = pending?.run
        setPending(null)
        run?.()
      }}
      onCancel={() => setPending(null)}
    />
  )
  return { ask: (name, kind, run) => setPending({ name, kind, run }), dialog }
}
