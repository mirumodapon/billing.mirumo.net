import { Snackbar } from '@billing/ui'
import { useCallback } from 'react'
import { useStore, type StoreApi } from 'zustand'
import type { UiState } from '../stores/uiStore'

/** 一次只顯示佇列最前面那一則；它消失後才輪到下一則 */
export function SnackbarHost({ store }: { store: StoreApi<UiState> }) {
  const item = useStore(store, (s) => s.queue[0])
  const dismiss = useStore(store, (s) => s.dismiss)
  const id = item?.id
  // 穩定的 onDismiss：Snackbar 把它放在計時器的相依陣列裡，每次 render 換一個
  // 新函式會讓倒數一直重來，snackbar 永遠不會自己消失
  const onDismiss = useCallback(() => {
    if (id) dismiss(id)
  }, [id, dismiss])
  if (!item) return null
  return (
    <Snackbar
      key={item.id}
      open
      message={item.message}
      actionLabel={item.actionLabel}
      onAction={item.onAction}
      onDismiss={onDismiss}
    />
  )
}
