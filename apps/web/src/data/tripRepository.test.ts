import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IntegrityError, MemberInUseError } from './errors'
import { freshDbName, makeExpense, makeTransfer, makeTrip, tickingClock } from './testing/fixtures'
import { IdbTripRepository } from './tripRepository'

let repo: IdbTripRepository

beforeEach(async () => {
  repo = await IdbTripRepository.open(freshDbName(), { now: tickingClock() })
})
afterEach(() => repo.close())

describe('trips', () => {
  it('stores and reads back a trip', async () => {
    await repo.saveTrip(makeTrip())
    expect((await repo.getTrip('t1'))?.name).toBe('東京五日')
  })

  /*
   * 時間戳只有一個產生點（規格 7.1）。呼叫端傳進來的值一律忽略，
   * 否則未來做同步比對時，某條路徑忘了更新就會出現錯的 updatedAt。
   */
  it('stamps both timestamps itself and ignores what the caller passed', async () => {
    const saved = await repo.saveTrip(makeTrip({ createdAt: '1999-01-01T00:00:00.000Z', updatedAt: 'nonsense' }))
    expect(saved.createdAt).toBe('2026-03-15T00:00:00.000Z')
    expect(saved.updatedAt).toBe('2026-03-15T00:00:00.000Z')
  })

  it('keeps createdAt and moves updatedAt forward on a later save', async () => {
    const first = await repo.saveTrip(makeTrip())
    const second = await repo.saveTrip({ ...first, name: '東京六日' })
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt > first.updatedAt).toBe(true)
  })

  it('lists trips newest departure first', async () => {
    await repo.saveTrip(makeTrip({ id: 'old', startDate: '2026-01-10' }))
    await repo.saveTrip(makeTrip({ id: 'new', startDate: '2026-05-01' }))
    await repo.saveTrip(makeTrip({ id: 'mid', startDate: '2026-03-14' }))
    expect((await repo.listTrips()).map((t) => t.id)).toEqual(['new', 'mid', 'old'])
  })

  // 軟刪除（規格 2.6）：留下墓碑，但清單與讀取都看不到
  it('soft-deletes a trip so it disappears from reads', async () => {
    await repo.saveTrip(makeTrip())
    await repo.deleteTrip('t1')
    expect(await repo.listTrips()).toEqual([])
    expect(await repo.getTrip('t1')).toBeUndefined()
  })

  it('treats deleting an unknown or already-deleted trip as a no-op', async () => {
    await expect(repo.deleteTrip('nope')).resolves.toBeUndefined()
    await repo.saveTrip(makeTrip())
    await repo.deleteTrip('t1')
    await expect(repo.deleteTrip('t1')).resolves.toBeUndefined()
  })
})

describe('removing a member who still has records (task#61)', () => {
  /*
   * core 假設輸入自洽：付款人被移出旅程而支出仍引用他，netBalances 會讓錢消失
   * （實測三人旅程 Σ net = −300）。決定不改 core，由資料層擋下這個移除。
   */
  it('refuses to drop a member who paid for something', async () => {
    const trip = await repo.saveTrip(makeTrip())
    await repo.saveExpense(makeExpense({ paidBy: 'c', split: { mode: 'even', participants: ['a', 'b'] } }))
    const withoutC = { ...trip, members: trip.members.filter((m) => m.id !== 'c') }
    await expect(repo.saveTrip(withoutC)).rejects.toBeInstanceOf(MemberInUseError)
  })

  it('refuses to drop a member who shares an expense, in every split mode', async () => {
    const trip = await repo.saveTrip(makeTrip())
    const withoutC = { ...trip, members: trip.members.filter((m) => m.id !== 'c') }
    for (const split of [
      { mode: 'even' as const, participants: ['a', 'c'] },
      { mode: 'exact' as const, amounts: { a: 1000, c: 2000 } },
      { mode: 'items' as const, overflowRule: 'even' as const, items: [{ id: 'i', name: '', amount: 3000, participants: ['c'] }] },
    ]) {
      await repo.saveExpense(makeExpense({ id: `e-${split.mode}`, split }))
      await expect(repo.saveTrip(withoutC), split.mode).rejects.toBeInstanceOf(MemberInUseError)
      await repo.deleteExpense(`e-${split.mode}`)
    }
  })

  it('refuses to drop a member who sent or received a transfer', async () => {
    const trip = await repo.saveTrip(makeTrip())
    await repo.saveTransfer(makeTransfer({ from: 'c', to: 'a' }))
    const withoutC = { ...trip, members: trip.members.filter((m) => m.id !== 'c') }
    await expect(repo.saveTrip(withoutC)).rejects.toBeInstanceOf(MemberInUseError)
  })

  it('names the members that are still in use', async () => {
    const trip = await repo.saveTrip(makeTrip())
    await repo.saveExpense(makeExpense({ paidBy: 'c' }))
    const onlyA = { ...trip, members: trip.members.filter((m) => m.id === 'a') }
    await expect(repo.saveTrip(onlyA)).rejects.toMatchObject({ memberIds: ['b', 'c'] })
  })

  // 移除失敗時旅程必須維持原狀，不能半套寫進去
  it('leaves the trip untouched when the removal is refused', async () => {
    const trip = await repo.saveTrip(makeTrip())
    await repo.saveExpense(makeExpense({ paidBy: 'c' }))
    await repo.saveTrip({ ...trip, name: '改名', members: trip.members.slice(0, 2) }).catch(() => undefined)
    const stored = await repo.getTrip('t1')
    expect(stored?.name).toBe('東京五日')
    expect(stored?.members).toHaveLength(3)
  })

  // 刪掉的紀錄不再算數：刪了那筆支出之後，成員就可以移除
  it('allows the removal once the records are deleted', async () => {
    const trip = await repo.saveTrip(makeTrip())
    await repo.saveExpense(makeExpense({ paidBy: 'c' }))
    await repo.deleteExpense('e1')
    const withoutC = { ...trip, members: trip.members.filter((m) => m.id !== 'c') }
    await expect(repo.saveTrip(withoutC)).resolves.toMatchObject({ id: 't1' })
  })
})

describe('expenses', () => {
  beforeEach(async () => {
    await repo.saveTrip(makeTrip())
  })

  it('lists a trip’s expenses newest date first', async () => {
    await repo.saveExpense(makeExpense({ id: 'e14', date: '2026-03-14' }))
    await repo.saveExpense(makeExpense({ id: 'e16', date: '2026-03-16' }))
    await repo.saveExpense(makeExpense({ id: 'e15', date: '2026-03-15' }))
    expect((await repo.listExpenses('t1')).map((e) => e.id)).toEqual(['e16', 'e15', 'e14'])
  })

  // 同一天的支出，後記的在前：使用者剛輸入的那一筆應該出現在最上面
  /*
   * id 刻意取成字母序與記錄順序相反。原本用 lunch / dinner，而 dinner 的字母序
   * 本來就在前，索引自然給的順序剛好等於預期——拿掉排序照樣全綠。
   */
  it('orders same-day expenses by when they were recorded, newest first', async () => {
    await repo.saveExpense(makeExpense({ id: 'first' }))
    await repo.saveExpense(makeExpense({ id: 'second' }))
    expect((await repo.listExpenses('t1')).map((e) => e.id)).toEqual(['second', 'first'])
  })

  it('only lists the requested trip', async () => {
    await repo.saveTrip(makeTrip({ id: 't2' }))
    await repo.saveExpense(makeExpense({ id: 'mine' }))
    await repo.saveExpense(makeExpense({ id: 'other', tripId: 't2' }))
    expect((await repo.listExpenses('t1')).map((e) => e.id)).toEqual(['mine'])
  })

  it('hides a soft-deleted expense', async () => {
    await repo.saveExpense(makeExpense())
    await repo.deleteExpense('e1')
    expect(await repo.listExpenses('t1')).toEqual([])
  })

  it('refuses an expense for a trip that does not exist', async () => {
    await expect(repo.saveExpense(makeExpense({ tripId: 'ghost' }))).rejects.toBeInstanceOf(IntegrityError)
  })

  // task#61 的另一個方向：不讓引用非成員的紀錄寫進去
  it('refuses an expense that names someone outside the trip', async () => {
    await expect(repo.saveExpense(makeExpense({ paidBy: 'stranger' }))).rejects.toBeInstanceOf(IntegrityError)
    await expect(
      repo.saveExpense(makeExpense({ split: { mode: 'even', participants: ['a', 'stranger'] } })),
    ).rejects.toMatchObject({ problems: ['member stranger is not in trip t1'] })
  })
})

describe('transfers', () => {
  beforeEach(async () => {
    await repo.saveTrip(makeTrip())
  })

  it('stores, lists and soft-deletes a transfer', async () => {
    const saved = await repo.saveTransfer(makeTransfer())
    expect(saved.createdAt).not.toBe('')
    expect((await repo.listTransfers('t1')).map((t) => t.id)).toEqual(['x1'])
    await repo.deleteTransfer('x1')
    expect(await repo.listTransfers('t1')).toEqual([])
  })

  it('refuses a transfer to someone outside the trip', async () => {
    await expect(repo.saveTransfer(makeTransfer({ to: 'stranger' }))).rejects.toBeInstanceOf(IntegrityError)
  })
})

describe('settings', () => {
  // 全新安裝時還沒有任何設定列，讀取要回預設值而不是 undefined
  it('returns the defaults before anything has been saved', async () => {
    const settings = await repo.getSettings()
    expect(settings.categories.map((c) => c.id)).toContain('cat.food')
  })

  it('round-trips saved settings', async () => {
    const settings = await repo.getSettings()
    await repo.saveSettings({ ...settings, locale: 'en-US', lastUsed: { currency: 'JPY' } })
    expect(await repo.getSettings()).toMatchObject({ locale: 'en-US', lastUsed: { currency: 'JPY' } })
  })
})

describe('snapshot export and import', () => {
  it('exports everything, tombstones included', async () => {
    await repo.saveTrip(makeTrip())
    await repo.saveExpense(makeExpense({ id: 'kept' }))
    await repo.saveExpense(makeExpense({ id: 'gone' }))
    await repo.deleteExpense('gone')
    const snap = await repo.exportSnapshot()
    expect(snap.app).toBe('billing-travel-split')
    expect(snap.expenses.map((e) => e.id).sort()).toEqual(['gone', 'kept'])
    expect(snap.expenses.find((e) => e.id === 'gone')?.deletedAt).toBeTruthy()
  })

  it('restores a backup into an empty database, timestamps untouched', async () => {
    await repo.saveTrip(makeTrip())
    await repo.saveExpense(makeExpense())
    const snap = await repo.exportSnapshot()

    const target = await IdbTripRepository.open(freshDbName(), { now: tickingClock('2030-01-01T00:00:00.000Z') })
    await target.importSnapshot(snap, 'replace')
    const restored = await target.listExpenses('t1')
    expect(restored.map((e) => e.id)).toEqual(['e1'])
    // 還原不是編輯：updatedAt 必須是備份裡的，不是匯入當下的 2030 年
    expect(restored[0]!.updatedAt).toBe(snap.expenses[0]!.updatedAt)
    target.close()
  })

  it('replace wipes what was there before', async () => {
    await repo.saveTrip(makeTrip({ id: 'local-only' }))
    const other = await IdbTripRepository.open(freshDbName(), { now: tickingClock() })
    await other.saveTrip(makeTrip({ id: 't1' }))
    await repo.importSnapshot(await other.exportSnapshot(), 'replace')
    expect((await repo.listTrips()).map((t) => t.id)).toEqual(['t1'])
    other.close()
  })

  // task#61：手改過的備份是唯一繞得過 UI 驗證的入口
  it('refuses a backup whose records name someone outside the trip, and writes nothing', async () => {
    await repo.saveTrip(makeTrip({ id: 'existing' }))
    const snap = await repo.exportSnapshot()
    const tampered = { ...snap, trips: [...snap.trips, makeTrip({ updatedAt: 'x' })], expenses: [makeExpense({ paidBy: 'ghost' })] }
    await expect(repo.importSnapshot(tampered, 'replace')).rejects.toMatchObject({
      name: 'SnapshotError',
      problems: ['expense e1: member ghost is not in trip t1'],
    })
    expect((await repo.listTrips()).map((t) => t.id)).toEqual(['existing'])
  })

  it('merge keeps the newer copy of each record', async () => {
    const trip = await repo.saveTrip(makeTrip())
    const older = await repo.saveExpense(makeExpense({ description: '舊的' }))
    const snap = await repo.exportSnapshot()
    await repo.saveExpense({ ...older, description: '本機較新' })
    const newerIncoming = { ...snap, expenses: [{ ...snap.expenses[0]!, description: '備份較新', updatedAt: '2099-01-01T00:00:00.000Z' }] }

    await repo.importSnapshot(snap, 'merge')
    expect((await repo.listExpenses(trip.id))[0]!.description).toBe('本機較新')
    await repo.importSnapshot(newerIncoming, 'merge')
    expect((await repo.listExpenses(trip.id))[0]!.description).toBe('備份較新')
  })

  it('merge keeps local records the backup does not have', async () => {
    await repo.saveTrip(makeTrip())
    await repo.saveExpense(makeExpense({ id: 'local' }))
    const other = await IdbTripRepository.open(freshDbName(), { now: tickingClock() })
    await other.saveTrip(makeTrip())
    await other.saveExpense(makeExpense({ id: 'remote' }))
    await repo.importSnapshot(await other.exportSnapshot(), 'merge')
    expect((await repo.listExpenses('t1')).map((e) => e.id).sort()).toEqual(['local', 'remote'])
    other.close()
  })

  /*
   * 合併本身也可能造出不一致：本機較新的旅程移除了 c，而備份裡有一筆 c 付的支出。
   * 兩份各自都是合法的，只驗證匯入的那一份擋不住。
   */
  it('refuses a merge whose combined result would be inconsistent', async () => {
    const other = await IdbTripRepository.open(freshDbName(), { now: tickingClock('2026-01-01T00:00:00.000Z') })
    await other.saveTrip(makeTrip())
    await other.saveExpense(makeExpense({ id: 'paid-by-c', paidBy: 'c' }))
    const backup = await other.exportSnapshot()
    other.close()

    const trip = await repo.saveTrip(makeTrip())
    await repo.saveTrip({ ...trip, members: trip.members.filter((m) => m.id !== 'c') })
    await expect(repo.importSnapshot(backup, 'merge')).rejects.toMatchObject({ name: 'SnapshotError' })
    expect(await repo.listExpenses('t1')).toEqual([])
  })

  // 備份裡用了本機沒有的自訂類別時，合併要把類別一起帶進來
  it('merge brings in categories the imported expenses need', async () => {
    await repo.saveTrip(makeTrip())
    const other = await IdbTripRepository.open(freshDbName(), { now: tickingClock() })
    const settings = await other.getSettings()
    await other.saveSettings({ ...settings, categories: [...settings.categories, { id: 'custom-1', name: '溫泉', icon: 'IconMountain', colorKey: 'accent6', builtin: false }] })
    await other.saveTrip(makeTrip())
    await other.saveExpense(makeExpense({ id: 'onsen', categoryId: 'custom-1' }))
    await repo.importSnapshot(await other.exportSnapshot(), 'merge')
    expect((await repo.getSettings()).categories.map((c) => c.id)).toContain('custom-1')
    other.close()
  })
})

describe('validating the backup on its own before merging', () => {
  /*
   * 合併依 id 去重，會把「同一個 id 出現兩次」的損壞備份悄悄修好、只留一筆——
   * 合併後的結果是自洽的，所以只驗證合併結果擋不住。損壞的檔案要整份拒絕，
   * 不能因為合併而被默默接受。這條讓「先驗證匯入的那一份」承重。
   */
  it('refuses a corrupt backup even when merging would paper over it', async () => {
    await repo.saveTrip(makeTrip())
    const snap = await repo.exportSnapshot()
    const corrupt = { ...snap, expenses: [makeExpense({ id: 'dup', description: 'one' }), makeExpense({ id: 'dup', description: 'two' })] }
    await expect(repo.importSnapshot(corrupt, 'merge')).rejects.toMatchObject({
      problems: ['expense id dup appears more than once'],
    })
    expect(await repo.listExpenses('t1')).toEqual([])
  })
})

// task#133：設定裡的「清除所有資料」
describe('clearing everything', () => {
  it('empties every store, and the repository still works afterwards', async () => {
    await repo.saveTrip(makeTrip({ id: 't1' }))
    await repo.saveExpense(makeExpense({ id: 'e1', tripId: 't1' }))
    await repo.saveTransfer(makeTransfer({ id: 'x1', tripId: 't1' }))
    await repo.saveSettings({ ...(await repo.getSettings()), locale: 'en-US' })
    await repo.clearAll()
    expect(await repo.listTrips()).toEqual([])
    expect(await repo.listExpenses('t1')).toEqual([])
    expect(await repo.listTransfers('t1')).toEqual([])
    expect((await repo.getSettings()).locale).not.toBe('en-US')
    await repo.saveTrip(makeTrip({ id: 't2' }))
    expect((await repo.listTrips()).map((t) => t.id)).toEqual(['t2'])
  })
})
