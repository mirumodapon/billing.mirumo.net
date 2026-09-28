import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ExpenseFilter } from '../domain/expenseFilter'

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
  /** 支出列表的篩選，依旅程分開（task#106）。只活在這次開 app 期間 */
  expenseFilters: Record<string, ExpenseFilter>
  setExpenseFilter(tripId: string, filter: ExpenseFilter): void
}

/** 畫面層的暫時狀態（規格 7.5 的 useUiStore）：snackbar 佇列與支出篩選 */
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
    expenseFilters: {},
    setExpenseFilter(tripId, filter) {
      set((s) => ({ expenseFilters: { ...s.expenseFilters, [tripId]: filter } }))
    },
  }))
}
