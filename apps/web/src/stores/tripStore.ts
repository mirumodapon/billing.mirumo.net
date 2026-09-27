import type { Expense, Transfer, Trip } from '@billing/core'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { MemberInUseError } from '../data/errors'
import { byStartDesc, type TripRepository } from '../data/tripRepository'
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

  return createStore<TripState>((set, get) => ({
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
  }))
}
