import { describe, expect, it, vi } from 'vitest'
import { MemberInUseError, StorageError } from '../data/errors'
import { makeExpense, makeTransfer, makeTrip } from '../data/testing/fixtures'
import { t } from '../i18n'
import { makeStores } from '../test/renderApp'

async function withTrip() {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京' }))
  await stores.repo.saveExpense(makeExpense({ tripId: 't1', paidBy: 'b', amount: 1000, currency: 'TWD', exchangeRate: 1 }))
  await stores.repo.saveTransfer(makeTransfer({ tripId: 't1' }))
  return stores
}

describe('tripStore: loading', () => {
  // 規格 7.5：首頁只載旅程清單，不載支出
  it('loads the trip list with summaries but no expenses', async () => {
    const { trips } = await withTrip()
    await trips.getState().loadTrips()
    const s = trips.getState()
    expect(s.loaded).toBe(true)
    expect(s.trips.map((x) => x.id)).toEqual(['t1'])
    expect(s.summaries.t1?.spentMinor).toBe(1000)
    expect(s.current).toBeUndefined()
  })

  it('opens a trip with its expenses and transfers', async () => {
    const { trips } = await withTrip()
    const trip = await trips.getState().openTrip('t1')
    expect(trip?.name).toBe('東京')
    expect(trips.getState().current).toMatchObject({ tripId: 't1' })
    expect(trips.getState().current?.expenses).toHaveLength(1)
    expect(trips.getState().current?.transfers).toHaveLength(1)
  })

  it('returns nothing for a deleted or missing trip and leaves current empty', async () => {
    const { repo, trips } = await withTrip()
    await repo.deleteTrip('t1')
    expect(await trips.getState().openTrip('t1')).toBeUndefined()
    expect(await trips.getState().openTrip('nope')).toBeUndefined()
    expect(trips.getState().current).toBeUndefined()
  })

  it('forgets the current trip when it is closed', async () => {
    const { trips } = await withTrip()
    await trips.getState().openTrip('t1')
    trips.getState().closeTrip()
    expect(trips.getState().current).toBeUndefined()
  })
})

describe('tripStore: saving', () => {
  it('shows a change at once and then keeps the repository’s timestamps', async () => {
    const { trips } = await withTrip()
    await trips.getState().loadTrips()
    const before = trips.getState().trips[0]!
    const saving = trips.getState().saveTrip({ ...before, name: '大阪' })
    expect(trips.getState().trips[0]!.name).toBe('大阪')
    const saved = await saving
    expect(saved?.updatedAt).not.toBe(before.updatedAt)
    expect(trips.getState().trips[0]!.updatedAt).toBe(saved?.updatedAt)
  })

  it('adds a new trip to the list in start-date order', async () => {
    const { trips } = await withTrip()
    await trips.getState().loadTrips()
    await trips.getState().saveTrip(makeTrip({ id: 'later', startDate: '2026-05-01' }))
    await trips.getState().saveTrip(makeTrip({ id: 'earlier', startDate: '2026-01-01' }))
    expect(trips.getState().trips.map((x) => x.id)).toEqual(['later', 't1', 'earlier'])
  })

  it('refreshes the saved trip’s summary', async () => {
    const { trips } = await withTrip()
    await trips.getState().loadTrips()
    await trips.getState().saveTrip({ ...trips.getState().trips[0]!, budget: { total: 2000, scope: 'group' } })
    expect(trips.getState().summaries.t1).toMatchObject({ spentMinor: 1000, budget: { level: 'normal' } })
  })

  // task#61：成員區塊要說得出「誰還被引用」，所以這個錯誤回到呼叫端而不是變成通用 snackbar
  it('rolls back and rethrows when a member is still referenced', async () => {
    const { trips, ui } = await withTrip()
    await trips.getState().loadTrips()
    const trip = trips.getState().trips[0]!
    const withoutB = { ...trip, members: trip.members.filter((m) => m.id !== 'b') }
    await expect(trips.getState().saveTrip(withoutB)).rejects.toBeInstanceOf(MemberInUseError)
    expect(trips.getState().trips[0]!.members.map((m) => m.id)).toContain('b')
    expect(ui.getState().queue).toEqual([])
  })

  it('rolls back and reports any other failure', async () => {
    const { repo, trips, ui } = await withTrip()
    await trips.getState().loadTrips()
    vi.spyOn(repo, 'saveTrip').mockRejectedValueOnce(new StorageError('write', 'trip'))
    expect(await trips.getState().saveTrip({ ...trips.getState().trips[0]!, name: '大阪' })).toBeUndefined()
    expect(trips.getState().trips[0]!.name).toBe('東京')
    expect(ui.getState().queue[0]?.message).toBe(t('error.saveFailed'))
  })

  it('removes a new trip again if creating it fails', async () => {
    const { repo, trips } = await withTrip()
    await trips.getState().loadTrips()
    vi.spyOn(repo, 'saveTrip').mockRejectedValueOnce(new StorageError('write', 'trip'))
    await trips.getState().saveTrip(makeTrip({ id: 'new' }))
    expect(trips.getState().trips.map((x) => x.id)).toEqual(['t1'])
  })

  // 回滾只還原失敗的那一趟：同時存成功的另一趟不能被一起倒回去
  it('rolls back only the trip whose save failed', async () => {
    const { repo, trips } = await withTrip()
    await repo.saveTrip(makeTrip({ id: 't2', name: '首爾' }))
    await trips.getState().loadTrips()
    let reject!: (e: Error) => void
    vi.spyOn(repo, 'saveTrip').mockImplementationOnce(() => new Promise((_, r) => (reject = r)))
    const [t1, t2] = ['t1', 't2'].map((id) => trips.getState().trips.find((x) => x.id === id)!)
    const failing = trips.getState().saveTrip({ ...t1!, name: '大阪' })
    await trips.getState().saveTrip({ ...t2!, name: '釜山' })
    reject(new StorageError('write', 'trip'))
    await failing
    const names = Object.fromEntries(trips.getState().trips.map((x) => [x.id, x.name]))
    expect(names).toEqual({ t1: '東京', t2: '釜山' })
  })
})

describe('tripStore: deleting', () => {
  // 規格 4.2：刪除不跳確認，snackbar 可復原
  it('removes a deleted trip at once and offers undo', async () => {
    const { repo, trips, ui } = await withTrip()
    await trips.getState().loadTrips()
    await trips.getState().deleteTrip('t1')
    expect(trips.getState().trips).toEqual([])
    expect(await repo.getTrip('t1')).toBeUndefined()
    expect(ui.getState().queue[0]).toMatchObject({
      message: t('tripList.deleted', { name: '東京' }),
      actionLabel: t('common.undo'),
    })
  })

  // Plan 6 D4：復原 = 把刪除前那一筆存回去，蓋掉墓碑；支出本來就沒被動
  it('brings the trip and its expenses back on undo', async () => {
    const { repo, trips, ui } = await withTrip()
    await trips.getState().loadTrips()
    await trips.getState().deleteTrip('t1')
    ui.getState().queue[0]!.onAction!()
    await vi.waitFor(async () => expect(await repo.getTrip('t1')).toBeDefined())
    expect(trips.getState().trips.map((x) => x.id)).toEqual(['t1'])
    expect(await repo.listExpenses('t1')).toHaveLength(1)
  })

  it('puts the trip back and reports it if deleting fails', async () => {
    const { repo, trips, ui } = await withTrip()
    await trips.getState().loadTrips()
    vi.spyOn(repo, 'deleteTrip').mockRejectedValueOnce(new StorageError('delete', 'trip'))
    await trips.getState().deleteTrip('t1')
    expect(trips.getState().trips.map((x) => x.id)).toEqual(['t1'])
    expect(ui.getState().queue[0]?.message).toBe(t('error.saveFailed'))
  })

  it('forgets the current trip when that trip is deleted', async () => {
    const { trips } = await withTrip()
    await trips.getState().loadTrips()
    await trips.getState().openTrip('t1')
    await trips.getState().deleteTrip('t1')
    expect(trips.getState().current).toBeUndefined()
  })
})
