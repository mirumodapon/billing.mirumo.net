import type { Expense, Transfer, Trip } from '@billing/core'
import { openTravelDb, type TravelDatabase } from './db'
import { defaultSettings } from './defaults'
import { IntegrityError, MemberInUseError, SnapshotError, StorageError } from './errors'
import { membersOfExpense, membersOfTransfer } from './references'
import { mergeSnapshots } from './mergeSnapshots'
import { APP_ID, SNAPSHOT_VERSION, type AppSettings, type Snapshot } from './types'
import { validateSnapshot } from './validateSnapshot'

/**
 * 預留同步接口的那道邊界（規格 7.1）。介面只描述意圖，不洩漏 IndexedDB。
 *
 * 與規格的一處差異：save* 回傳存進去的那一筆，而不是 void。時間戳由這裡蓋，
 * 呼叫端做樂觀更新時需要拿回權威的 updatedAt，否則就得再讀一次。
 */
export interface TripRepository {
  listTrips(): Promise<Trip[]>
  getTrip(id: string): Promise<Trip | undefined>
  saveTrip(trip: Trip): Promise<Trip>
  /** 軟刪除 */
  deleteTrip(id: string): Promise<void>

  listExpenses(tripId: string): Promise<Expense[]>
  saveExpense(expense: Expense): Promise<Expense>
  deleteExpense(id: string): Promise<void>

  listTransfers(tripId: string): Promise<Transfer[]>
  saveTransfer(transfer: Transfer): Promise<Transfer>
  deleteTransfer(id: string): Promise<void>

  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<void>

  exportSnapshot(): Promise<Snapshot>
  importSnapshot(snapshot: Snapshot, mode: 'replace' | 'merge'): Promise<void>
}

export interface RepositoryOptions {
  /** 時間來源。測試用來固定時間；正式環境用預設值 */
  now?: () => string
}

const DOMAIN_ERRORS = [MemberInUseError, IntegrityError, SnapshotError]

/**
 * IndexedDB 的錯誤一律包成 StorageError 並附上操作語意；業務規則的錯誤
 * 原樣往外拋，呼叫端才分得出「存不進去」與「不該存」。
 */
async function guard<T>(op: StorageError['op'], entity: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (DOMAIN_ERRORS.some((E) => error instanceof E)) throw error
    throw new StorageError(op, entity, error)
  }
}

/** 支出與轉帳的順序：日期新的在前；同一天的依建立時間。store 重排時用同一個函式 */
export const byDateDesc = <T extends { date: string; createdAt: string }>(a: T, b: T) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)

/** 旅程列表的順序：出發日新的在前；同一天出發的依建立時間。store 重排時用同一個函式 */
export const byStartDesc = (a: Trip, b: Trip) =>
  b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt)

export class IdbTripRepository implements TripRepository {
  private constructor(
    protected readonly db: TravelDatabase,
    protected readonly now: () => string,
  ) {}

  static async open(name?: string, options: RepositoryOptions = {}): Promise<IdbTripRepository> {
    const db = await guard('read', 'database', () => openTravelDb(name))
    return new IdbTripRepository(db, options.now ?? (() => new Date().toISOString()))
  }

  close(): void {
    this.db.close()
  }

  // ---- trips ----

  listTrips(): Promise<Trip[]> {
    return guard('read', 'trips', async () => {
      const all = await this.db.getAll('trips')
      // 出發日新的在前；同一天出發的依建立時間
      return all
        .filter((trip) => !trip.deletedAt)
        .sort(byStartDesc)
    })
  }

  getTrip(id: string): Promise<Trip | undefined> {
    return guard('read', 'trip', async () => {
      const trip = await this.db.get('trips', id)
      return trip && !trip.deletedAt ? trip : undefined
    })
  }

  /**
   * 時間戳只在這裡產生（規格 7.1）：createdAt 第一次寫入時蓋、之後沿用，
   * updatedAt 每次都蓋。呼叫端傳進來的值一律忽略。
   *
   * 讀紀錄與寫旅程放在同一個交易裡，檢查與寫入之間才不會有別的寫入插進來。
   */
  saveTrip(trip: Trip): Promise<Trip> {
    return guard('write', 'trip', async () => {
      const tx = this.db.transaction(['trips', 'expenses', 'transfers'], 'readwrite')
      const [existing, expenses, transfers] = await Promise.all([
        tx.objectStore('trips').get(trip.id),
        tx.objectStore('expenses').index('by-trip').getAll(trip.id),
        tx.objectStore('transfers').index('by-trip').getAll(trip.id),
      ])

      // task#61：成員被移除而紀錄仍引用他，netBalances 會讓錢消失
      const kept = new Set(trip.members.map((m) => m.id))
      const orphaned = new Set<string>()
      for (const e of expenses) if (!e.deletedAt) for (const id of membersOfExpense(e)) if (!kept.has(id)) orphaned.add(id)
      for (const t of transfers) if (!t.deletedAt) for (const id of membersOfTransfer(t)) if (!kept.has(id)) orphaned.add(id)
      // 檢查一律在任何寫入之前，所以直接拋出即可：交易裡沒有待寫的東西，
      // 會自行結束而不留下半套資料
      if (orphaned.size > 0) throw new MemberInUseError(trip.id, [...orphaned].sort())

      const now = this.now()
      const saved: Trip = { ...trip, createdAt: existing?.createdAt ?? now, updatedAt: now }
      await Promise.all([tx.objectStore('trips').put(saved), tx.done])
      return saved
    })
  }

  deleteTrip(id: string): Promise<void> {
    return this.softDelete('trips', id)
  }

  // ---- expenses & transfers ----

  listExpenses(tripId: string): Promise<Expense[]> {
    return guard('read', 'expenses', async () => {
      const rows = await this.db.getAllFromIndex('expenses', 'by-trip', tripId)
      return rows.filter((e) => !e.deletedAt).sort(byDateDesc)
    })
  }

  saveExpense(expense: Expense): Promise<Expense> {
    return this.saveRecord('expenses', expense, membersOfExpense(expense))
  }

  deleteExpense(id: string): Promise<void> {
    return this.softDelete('expenses', id)
  }

  listTransfers(tripId: string): Promise<Transfer[]> {
    return guard('read', 'transfers', async () => {
      const rows = await this.db.getAllFromIndex('transfers', 'by-trip', tripId)
      return rows.filter((t) => !t.deletedAt).sort(byDateDesc)
    })
  }

  saveTransfer(transfer: Transfer): Promise<Transfer> {
    return this.saveRecord('transfers', transfer, membersOfTransfer(transfer))
  }

  deleteTransfer(id: string): Promise<void> {
    return this.softDelete('transfers', id)
  }

  // ---- settings ----

  getSettings(): Promise<AppSettings> {
    return guard('read', 'settings', async () => {
      const row = await this.db.get('settings', 'app')
      return row?.settings ?? defaultSettings()
    })
  }

  saveSettings(settings: AppSettings): Promise<void> {
    return guard('write', 'settings', async () => {
      await this.db.put('settings', { key: 'app', settings })
    })
  }

  // ---- snapshot ----

  /**
   * 匯出全部資料，包含軟刪除的墓碑（規格 2.6：為同步預留）。
   * 照片不在這裡——它們以二進位放進 zip，見 archive.ts。
   */
  exportSnapshot(): Promise<Snapshot> {
    return guard('read', 'snapshot', async () => {
      const tx = this.db.transaction(['trips', 'expenses', 'transfers', 'settings'])
      const [trips, expenses, transfers, settingsRow] = await Promise.all([
        tx.objectStore('trips').getAll(),
        tx.objectStore('expenses').getAll(),
        tx.objectStore('transfers').getAll(),
        tx.objectStore('settings').get('app'),
        tx.done,
      ])
      return {
        schemaVersion: SNAPSHOT_VERSION,
        exportedAt: this.now(),
        app: APP_ID,
        settings: settingsRow?.settings ?? defaultSettings(),
        trips,
        expenses,
        transfers,
      }
    })
  }

  /**
   * 還原備份。
   *
   * replace：清空後寫入備份的內容。
   * merge：同一個 id 保留 updatedAt 較新的那一筆；設定沿用目前的，但補上備份
   *        裡用到而本機沒有的類別與付款方式，匯入的支出才引用得到。
   *
   * 兩種模式都先在記憶體裡算出「匯入之後的完整狀態」並整份驗證，不過就一筆都
   * 不寫。合併本身也可能造出不一致：本機較新的旅程少了一位成員，而備份裡的支出
   * 還引用他。只驗證匯入的那一份擋不住這種情況。
   *
   * 時間戳原樣保留、不重蓋：這是還原，不是編輯。
   */
  importSnapshot(snapshot: Snapshot, mode: 'replace' | 'merge'): Promise<void> {
    return guard('write', 'snapshot', async () => {
      const incoming = validateSnapshot(snapshot)
      if (!incoming.ok) throw new SnapshotError(incoming.problems)

      const result = mode === 'replace' ? snapshot : mergeSnapshots(await this.exportSnapshot(), snapshot)
      const merged = validateSnapshot(result)
      if (!merged.ok) throw new SnapshotError(merged.problems)

      const tx = this.db.transaction(['trips', 'expenses', 'transfers', 'settings'], 'readwrite')
      const trips = tx.objectStore('trips')
      const expenses = tx.objectStore('expenses')
      const transfers = tx.objectStore('transfers')
      await Promise.all([
        trips.clear(),
        expenses.clear(),
        transfers.clear(),
        ...result.trips.map((t) => trips.put(t)),
        ...result.expenses.map((e) => expenses.put(e)),
        ...result.transfers.map((t) => transfers.put(t)),
        tx.objectStore('settings').put({ key: 'app', settings: result.settings }),
        // tx.done 一定要一起等：交易失敗時它的 rejection 沒人接，會變成未處理錯誤
        tx.done,
      ])
    })
  }

  // ---- 共用 ----

  /**
   * 寫入前確認旅程存在、而且引用到的每個人都是該旅程的成員。
   * 這是 task#61 的另一個方向：MemberInUseError 擋移除，這裡擋寫入。
   */
  private saveRecord<S extends 'expenses' | 'transfers'>(
    store: S,
    record: S extends 'expenses' ? Expense : Transfer,
    referenced: Set<string>,
  ): Promise<S extends 'expenses' ? Expense : Transfer> {
    const entity = store === 'expenses' ? 'expense' : 'transfer'
    return guard('write', entity, async () => {
      const tx = this.db.transaction(['trips', store], 'readwrite')
      const [trip, existing] = await Promise.all([
        tx.objectStore('trips').get(record.tripId),
        tx.objectStore(store).get(record.id),
      ])
      const problems: string[] = []
      if (!trip || trip.deletedAt) problems.push(`trip ${record.tripId} does not exist`)
      else {
        const members = new Set(trip.members.map((m) => m.id))
        for (const id of [...referenced].sort()) if (!members.has(id)) problems.push(`member ${id} is not in trip ${trip.id}`)
      }
      if (problems.length > 0) throw new IntegrityError(problems)
      const now = this.now()
      const saved = { ...record, createdAt: existing?.createdAt ?? now, updatedAt: now }
      await Promise.all([tx.objectStore(store).put(saved as never), tx.done])
      return saved as S extends 'expenses' ? Expense : Transfer
    })
  }

  /** 蓋上 deletedAt 當墓碑（規格 2.6）。不存在的 id 靜默略過，刪兩次不是錯誤 */
  private softDelete(store: 'trips' | 'expenses' | 'transfers', id: string): Promise<void> {
    return guard('delete', store, async () => {
      const tx = this.db.transaction(store, 'readwrite')
      const row = await tx.store.get(id)
      if (row && !row.deletedAt) {
        const now = this.now()
        await tx.store.put({ ...row, deletedAt: now, updatedAt: now })
      }
      await tx.done
    })
  }
}
