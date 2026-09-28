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
  /** 同 saveExpense，但不動摘要：轉帳不是消費（規格 2.5） */
  saveTransfer(transfer: Transfer): Promise<Transfer | undefined>
  deleteTransfer(id: string): Promise<void>
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

    saveExpense: (expense) => saveRecord('expenses', expense),
    deleteExpense: (id) => deleteRecord('expenses', id),
    saveTransfer: (transfer) => saveRecord('transfers', transfer),
    deleteTransfer: (id) => deleteRecord('transfers', id),
  }))

  type Kind = 'expenses' | 'transfers'
  type RecordOf<K extends Kind> = K extends 'expenses' ? Expense : Transfer

  const persist = {
    expenses: { save: (r: Expense) => repo.saveExpense(r), remove: (id: string) => repo.deleteExpense(id) },
    transfers: { save: (r: Transfer) => repo.saveTransfer(r), remove: (id: string) => repo.deleteTransfer(id) },
  }

  /** 只動當前旅程的那一份清單；存的是別趟旅程的紀錄時什麼都不改 */
  function setRecords<K extends Kind>(kind: K, tripId: string, change: (list: RecordOf<K>[]) => RecordOf<K>[]) {
    store.setState((s) =>
      s.current?.tripId === tripId ? { current: { ...s.current, [kind]: change(s.current[kind] as RecordOf<K>[]) } } : {},
    )
  }

  /** 同 saveTrip 的規則：只還原 id 那一筆 */
  function rollbackRecord<R extends Expense | Transfer>(now: R[], before: R[], id: string): R[] {
    const old = before.find((r) => r.id === id)
    const rest = now.filter((r) => r.id !== id)
    return (old ? [...rest, old] : rest).sort(byDateDesc)
  }

  /** 樂觀更新：先放進清單，存好後換成帶時間戳的那一筆；失敗只還原這一筆並跳 snackbar */
  async function saveRecord<K extends Kind>(kind: K, record: RecordOf<K>): Promise<RecordOf<K> | undefined> {
    const before = (store.getState().current?.[kind] ?? []) as RecordOf<K>[]
    setRecords(kind, record.tripId, (list) => [...list.filter((r) => r.id !== record.id), record].sort(byDateDesc))
    try {
      // persist 是依 kind 查表，TypeScript 分不出兩邊的型別對得上，只能在這裡轉一次
      const save = persist[kind].save as unknown as (r: RecordOf<K>) => Promise<RecordOf<K>>
      const saved = await save(record)
      setRecords(kind, record.tripId, (list) => list.map((r) => (r.id === saved.id ? saved : r)).sort(byDateDesc))
      // 規格 2.5：轉帳不是消費，不影響總支出與預算
      if (kind === 'expenses') await refreshSummary(record.tripId)
      return saved
    } catch {
      setRecords(kind, record.tripId, (list) => rollbackRecord(list, before, record.id))
      ui.getState().show({ id: 'save-failed', message: t('error.saveFailed') })
      return undefined
    }
  }

  /** 樂觀移除，成功後 snackbar 提供復原：存回刪除前那一筆就蓋掉墓碑 */
  async function deleteRecord<K extends Kind>(kind: K, id: string): Promise<void> {
    const current = store.getState().current
    const before = (current?.[kind] ?? []) as RecordOf<K>[]
    const record = before.find((r) => r.id === id)
    if (!current || !record) return
    setRecords(kind, current.tripId, (list) => list.filter((r) => r.id !== id))
    try {
      await persist[kind].remove(id)
    } catch {
      setRecords(kind, current.tripId, (list) => rollbackRecord(list, before, id))
      ui.getState().show({ id: 'save-failed', message: t('error.saveFailed') })
      return
    }
    if (kind === 'expenses') await refreshSummary(current.tripId)
    ui.getState().show({
      id: `${kind}-deleted`,
      message: deletedMessage(record),
      actionLabel: t('common.undo'),
      onAction: () => void saveRecord(kind, record),
    })
  }

  function deletedMessage(record: Expense | Transfer): string {
    if ('description' in record) return t('expense.deleted', { name: record.description.trim() || t('expense.untitled') })
    const members = store.getState().trips.find((trip) => trip.id === record.tripId)?.members ?? []
    const name = (id: string) => members.find((m) => m.id === id)?.name ?? id
    return t('transfer.deleted', { from: name(record.from), to: name(record.to) })
  }

  /** 重算單一旅程的列表摘要：總支出與預算都跟著支出變 */
  async function refreshSummary(tripId: string) {
    const trip = store.getState().trips.find((t) => t.id === tripId)
    if (!trip) return
    const summary = await summarizeTrips(repo, [trip])
    store.setState((s) => ({ summaries: { ...s.summaries, ...summary } }))
  }

  return store
}
