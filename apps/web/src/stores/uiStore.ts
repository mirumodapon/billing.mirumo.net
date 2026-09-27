import { createStore, type StoreApi } from 'zustand/vanilla'

export interface SnackItem {
  id: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export interface UiState {
  queue: SnackItem[]
  /** 回傳 id。同一個 id 再 show 一次會原地取代，而不是重複排隊 */
  show(item: Omit<SnackItem, 'id'> & { id?: string }): string
  dismiss(id: string): void
}

/** 畫面層的暫時狀態（規格 7.5 的 useUiStore）。目前只有 snackbar 佇列 */
export function createUiStore(): StoreApi<UiState> {
  return createStore<UiState>((set) => ({
    queue: [],
    show(item) {
      const id = item.id ?? crypto.randomUUID()
      const next: SnackItem = { ...item, id }
      set((s) => {
        const at = s.queue.findIndex((q) => q.id === id)
        if (at === -1) return { queue: [...s.queue, next] }
        const queue = [...s.queue]
        queue[at] = next
        return { queue }
      })
      return id
    },
    dismiss(id) {
      set((s) => ({ queue: s.queue.filter((q) => q.id !== id) }))
    },
  }))
}
