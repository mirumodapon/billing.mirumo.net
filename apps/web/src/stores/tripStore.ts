import type { Expense, Transfer, Trip } from '@billing/core'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { MemberInUseError } from '../data/errors'
import { byDateDesc, byStartDesc, type TripRepository } from '../data/tripRepository'
import { summarizeTrips, type TripSummary } from '../domain/summarizeTrips'
import { t } from '../i18n'
import type { UiState } from './uiStore'

export interface CurrentTrip {
  tripId: string
  expenses: Expense[]
  transfers: Transfer[]
}

export interface TripState {
  trips: Trip[]
  summaries: Record<string, TripSummary>
  loaded: boolean
  /** 進入某趟旅程後才有（規格 7.5：首頁不載支出） */
  current?: CurrentTrip
  loadTrips(): Promise<void>
  /** 載入該旅程的支出與轉帳；旅程不存在或已刪除回傳 undefined */
  openTrip(id: string): Promise<Trip | undefined>
  closeTrip(): void
  /**
   * 樂觀更新。MemberInUseError 回滾後原樣拋出，讓成員區塊說明是誰還被引用；
   * 其他錯誤回滾並跳 snackbar，回傳 undefined。
   */
  saveTrip(trip: Trip): Promise<Trip | undefined>
  /** 樂觀移除，成功後 snackbar 提供復原（Plan 6 D4） */
  deleteTrip(id: string): Promise<void>
  /** 樂觀更新當前旅程的支出並重算該趟摘要；失敗回滾 + snackbar，回傳 undefined */
  saveExpense(expense: Expense): Promise<Expense | undefined>
  /** 樂觀移除 + snackbar「復原」（復原 = 把刪除前那一筆存回去） */
  deleteExpense(id: string): Promise<void>
}

/**
 * 只還原 id 這一趟：取 before 裡的那一筆（新建的就移除），其他旅程維持現況。
 * 整包倒回 before 的話，同時存成功的另一趟會被一起倒回去。
 */
function rollback(now: Trip[], before: Trip[], id: string): Trip[] {
  const old = before.find((t) => t.id === id)
  const rest = now.filter((t) => t.id !== id)
  return (old ? [...rest, old] : rest).sort(byStartDesc)
}

/** 同一個規則用在當前旅程的支出上：只還原 id 那一筆 */
function rollbackExpense(now: Expense[], before: Expense[], id: string): Expense[] {
  const old = before.find((e) => e.id === id)
  const rest = now.filter((e) => e.id !== id)
  return (old ? [...rest, old] : rest).sort(byDateDesc)
}

export function createTripStore({ repo, ui }: { repo: TripRepository; ui: StoreApi<UiState> }): StoreApi<TripState> {
  const saveFailed = () => ui.getState().show({ id: 'save-failed', message: t('error.saveFailed') })

  const store = createStore<TripState>((set, get) => ({
    trips: [],
    summaries: {},
    loaded: false,

    async loadTrips() {
      try {
        const trips = await repo.listTrips()
        set({ trips, summaries: await summarizeTrips(repo, trips), loaded: true })
      } catch {
        set({ loaded: true })
        ui.getState().show({ id: 'load-failed', message: t('error.loadFailed') })
      }
    },

    async openTrip(id) {
      const trip = await repo.getTrip(id)
      if (!trip) {
        set({ current: undefined })
        return undefined
      }
      const [expenses, transfers] = await Promise.all([repo.listExpenses(id), repo.listTransfers(id)])
      set({ current: { tripId: id, expenses, transfers } })
      return trip
    },

    closeTrip() {
      set({ current: undefined })
    },

    async saveTrip(trip) {
      const before = get().trips
      set({ trips: [...before.filter((t) => t.id !== trip.id), trip].sort(byStartDesc) })
      try {
        const saved = await repo.saveTrip(trip)
        set((s) => ({ trips: s.trips.map((t) => (t.id === saved.id ? saved : t)).sort(byStartDesc) }))
        const summary = await summarizeTrips(repo, [saved])
        set((s) => ({ summaries: { ...s.summaries, ...summary } }))
        return saved
      } catch (error) {
        set((s) => ({ trips: rollback(s.trips, before, trip.id) }))
        if (error instanceof MemberInUseError) throw error
        saveFailed()
        return undefined
      }
    },

    async deleteTrip(id) {
      const before = get().trips
      const trip = before.find((t) => t.id === id)
      if (!trip) return
      set((s) => ({
        trips: s.trips.filter((t) => t.id !== id),
        current: s.current?.tripId === id ? undefined : s.current,
      }))
      try {
        await repo.deleteTrip(id)
      } catch {
        set((s) => ({ trips: rollback(s.trips, before, id) }))
        saveFailed()
        return
      }
      ui.getState().show({
        // 同一個 id：連刪兩趟只留最後一則，而不是排隊等第一則倒數完
        id: 'trip-deleted',
        message: t('tripList.deleted', { name: trip.name }),
        actionLabel: t('common.undo'),
        // 存回刪除前那一筆就會蓋掉墓碑；它的支出與轉帳從來沒被動過
        onAction: () => void get().saveTrip(trip),
      })
    },

    async saveExpense(expense) {
      const isOpen = get().current?.tripId === expense.tripId
      const before = get().current?.expenses ?? []
      const setExpenses = (change: (list: Expense[]) => Expense[]) =>
        set((s) => (s.current?.tripId === expense.tripId ? { current: { ...s.current, expenses: change(s.current.expenses) } } : {}))

      if (isOpen) setExpenses((list) => [...list.filter((e) => e.id !== expense.id), expense].sort(byDateDesc))
      try {
        const saved = await repo.saveExpense(expense)
        setExpenses((list) => list.map((e) => (e.id === saved.id ? saved : e)).sort(byDateDesc))
        await refreshSummary(expense.tripId)
        return saved
      } catch {
        setExpenses((list) => rollbackExpense(list, before, expense.id))
        saveFailed()
        return undefined
      }
    },

    async deleteExpense(id) {
      const current = get().current
      const expense = current?.expenses.find((e) => e.id === id)
      if (!current || !expense) return
      const before = current.expenses
      const setExpenses = (change: (list: Expense[]) => Expense[]) =>
        set((s) => (s.current?.tripId === current.tripId ? { current: { ...s.current, expenses: change(s.current.expenses) } } : {}))

      setExpenses((list) => list.filter((e) => e.id !== id))
      try {
        await repo.deleteExpense(id)
      } catch {
        setExpenses((list) => rollbackExpense(list, before, id))
        saveFailed()
        return
      }
      await refreshSummary(current.tripId)
      ui.getState().show({
        id: 'expense-deleted',
        message: t('expense.deleted', { name: expense.description.trim() || t('expense.untitled') }),
        actionLabel: t('common.undo'),
        // 存回刪除前那一筆就蓋掉墓碑（與旅程的復原同一個做法）
        onAction: () => void get().saveExpense(expense),
      })
    },
  }))

  /** 重算單一旅程的列表摘要：總支出與預算都跟著支出變 */
  async function refreshSummary(tripId: string) {
    const trip = store.getState().trips.find((t) => t.id === tripId)
    if (!trip) return
    const summary = await summarizeTrips(repo, [trip])
    store.setState((s) => ({ summaries: { ...s.summaries, ...summary } }))
  }

  return store
}
