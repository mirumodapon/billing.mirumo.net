import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IdbBlobStore } from './blobStore'
import { openTravelDb } from './db'
import { DraftStore } from './drafts'
import { housekeep } from './housekeeping'
import { freshDbName, makeExpense, makeTransfer, makeTrip } from './testing/fixtures'
import { IdbTripRepository } from './tripRepository'

const OLD = '2026-03-01T00:00:00.000Z' // 4 天前
const RECENT = '2026-03-04T12:00:00.000Z' // 半天前
const NOW = new Date('2026-03-05T00:00:00.000Z')
const at = (iso: string) => () => iso
const photo = (id: string) => ({ id, mimeType: 'image/webp', byteSize: 1, width: 1, height: 1 })

/**
 * 情境：
 * - gone：4 天前刪掉的旅程，底下還有支出、轉帳、草稿
 * - fresh：半天前刪掉的旅程（還在寬限期內）
 * - live：正常的旅程。支出 keep 有照片 p1；oldDel 4 天前刪掉、照片 p2；newDel 半天前刪掉、照片 p3；
 *   轉帳 tOld 4 天前刪掉；草稿引用照片 p4
 * - 照片 p5 沒人引用且是舊的；p6 沒人引用但剛存（可能是表單正在用、草稿還沒寫進去）
 */
async function scenario() {
  const name = freshDbName()
  const old = await IdbTripRepository.open(name, { now: at(OLD) })
  const recent = await IdbTripRepository.open(name, { now: at(RECENT) })
  for (const id of ['gone', 'fresh', 'live']) await old.saveTrip(makeTrip({ id }))
  await old.saveExpense(makeExpense({ id: 'goneExp', tripId: 'gone' }))
  await old.saveTransfer(makeTransfer({ id: 'goneTr', tripId: 'gone' }))
  await old.saveExpense(makeExpense({ id: 'freshExp', tripId: 'fresh' }))
  await old.saveExpense(makeExpense({ id: 'keep', tripId: 'live', attachments: [photo('p1')] }))
  await old.saveExpense(makeExpense({ id: 'oldDel', tripId: 'live', attachments: [photo('p2')] }))
  await old.saveExpense(makeExpense({ id: 'newDel', tripId: 'live', attachments: [photo('p3')] }))
  await old.saveTransfer(makeTransfer({ id: 'tOld', tripId: 'live' }))
  await old.deleteTrip('gone')
  await old.deleteExpense('oldDel')
  await old.deleteTransfer('tOld')
  await recent.deleteTrip('fresh')
  await recent.deleteExpense('newDel')
  old.close()
  recent.close()

  const drafts = await DraftStore.open(name, at(OLD))
  await drafts.save('/trip/gone/expense/new', { attachments: [] })
  await drafts.save('/trip/live/expense/new', { attachments: [photo('p4')] })
  drafts.close()

  const oldBlobs = await IdbBlobStore.open(name, at(OLD))
  for (const id of ['p1', 'p2', 'p3', 'p4', 'p5']) await oldBlobs.restore(id, new Blob(['x']))
  oldBlobs.close()
  const newBlobs = await IdbBlobStore.open(name, at(RECENT))
  await newBlobs.restore('p6', new Blob(['x']))
  newBlobs.close()
  return name
}

async function keysIn(name: string) {
  const db = await openTravelDb(name)
  const keys = {
    trips: (await db.getAllKeys('trips')).sort(),
    expenses: (await db.getAllKeys('expenses')).sort(),
    transfers: (await db.getAllKeys('transfers')).sort(),
    drafts: (await db.getAllKeys('drafts')).sort(),
    blobs: (await db.getAllKeys('blobs')).sort(),
  }
  db.close()
  return keys
}

describe('housekeep (task#89, task#118)', () => {
  // 刪掉超過 3 天的旅程整趟移除，連同它的支出、轉帳與草稿；寬限期內的不動
  it('removes trips deleted more than three days ago, with everything under them', async () => {
    const name = await scenario()
    await housekeep(name, NOW)
    const keys = await keysIn(name)
    expect(keys.trips).toEqual(['fresh', 'live'])
    expect(keys.expenses).not.toContain('goneExp')
    expect(keys.expenses).toContain('freshExp')
    expect(keys.transfers).not.toContain('goneTr')
    expect(keys.drafts).toEqual(['/trip/live/expense/new'])
  })

  it('removes expenses and transfers deleted more than three days ago', async () => {
    const name = await scenario()
    await housekeep(name, NOW)
    const keys = await keysIn(name)
    expect(keys.expenses).toEqual(['freshExp', 'keep', 'newDel'])
    expect(keys.transfers).toEqual([])
  })

  // 照片看引用：還有支出（含寬限期內刪掉的，可能被復原）或草稿在用的留著；沒人用的過了寬限期才刪
  it('removes photos nothing refers to once they are old enough', async () => {
    const name = await scenario()
    const result = await housekeep(name, NOW)
    expect((await keysIn(name)).blobs).toEqual(['p1', 'p3', 'p4', 'p6'])
    expect(result).toEqual({ trips: 1, expenses: 2, transfers: 2, drafts: 1, blobs: 2 })
  })

  it('does nothing on a clean database', async () => {
    const name = freshDbName()
    expect(await housekeep(name, NOW)).toEqual({ trips: 0, expenses: 0, transfers: 0, drafts: 0, blobs: 0 })
  })
})
