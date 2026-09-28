import { createStore, type StoreApi } from 'zustand/vanilla'
import { readSession, writeSession } from '../data/session'
import { isFilterActive, type ExpenseFilter } from '../domain/expenseFilter'

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
  /** 支出列表的篩選，依旅程分開（task#106）。最近一次的會寫進 session，重開 app 還在 */
  expenseFilters: Record<string, ExpenseFilter>
  setExpenseFilter(tripId: string, filter: ExpenseFilter): void
}

/** 冷啟動時從 session 帶回上次的篩選 */
function seededFilters(): Record<string, ExpenseFilter> {
  const saved = readSession()?.filters
  if (!saved) return {}
  const { tripId, ...filter } = saved
  return { [tripId]: filter }
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
    expenseFilters: seededFilters(),
    setExpenseFilter(tripId, filter) {
      set((s) => ({ expenseFilters: { ...s.expenseFilters, [tripId]: filter } }))
      // 規格 7.9「篩選變更 → 立即寫 session」：重開 app 還是同樣的篩選。沒篩選時不留欄位
      const session = { ...(readSession() ?? { route: location.hash.replace(/^#/, '') || '/' }) }
      if (isFilterActive(filter)) session.filters = { tripId, ...filter }
      else delete session.filters
      writeSession(session)
    },
  }))
}
