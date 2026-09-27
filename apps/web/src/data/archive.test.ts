import 'fake-indexeddb/auto'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildExport, collectPhotos, importArchive, readImport } from './archive'
import { IdbBlobStore } from './blobStore'
import { freshDbName, makeExpense, makeTrip, tickingClock } from './testing/fixtures'
import { IdbTripRepository } from './tripRepository'
import type { Snapshot } from './types'

const csv = { 'expenses.csv': 'a\r\n', 'items.csv': 'b\r\n', 'transfers.csv': 'c\r\n' }
const when = new Date(2026, 8, 24)

let repo: IdbTripRepository
let blobs: IdbBlobStore
let snapshot: Snapshot
let photoId: string

beforeEach(async () => {
  const name = freshDbName()
  repo = await IdbTripRepository.open(name, { now: tickingClock() })
  blobs = await IdbBlobStore.open(name)
  photoId = await blobs.put(new Blob([new Uint8Array([9, 8, 7])], { type: 'image/webp' }))
  await repo.saveTrip(makeTrip())
  await repo.saveExpense(makeExpense({ attachments: [{ id: photoId, mimeType: 'image/webp', byteSize: 3, width: 10, height: 10 }] }))
  snapshot = await repo.exportSnapshot()
})
afterEach(() => {
  repo.close()
  blobs.close()
})

const entriesOf = async (file: File) => unzipSync(new Uint8Array(await file.arrayBuffer()))

describe('buildExport', () => {
  it('writes a single JSON file when only JSON is chosen and photos are off', async () => {
    const file = await buildExport(snapshot, csv, new Map(), { json: true, csv: false, includePhotos: false }, when)
    expect(file.name).toBe('travel-split-2026-09-24.json')
    expect(JSON.parse(await file.text()).app).toBe('billing-travel-split')
  })

  // CSV 是三個檔案，單一檔案裝不下——規格的規則在這裡有缺口
  it('zips CSV even on its own, because it is three files', async () => {
    const file = await buildExport(snapshot, csv, new Map(), { json: false, csv: true, includePhotos: false }, when)
    expect(file.name).toBe('travel-split-2026-09-24.zip')
    expect(Object.keys(await entriesOf(file)).sort()).toEqual(['expenses.csv', 'items.csv', 'transfers.csv'])
  })

  it('zips JSON with photos, storing each photo under its attachment id', async () => {
    const photos = await collectPhotos(snapshot, blobs)
    const file = await buildExport(snapshot, csv, photos, { json: true, csv: false, includePhotos: true }, when)
    const entries = await entriesOf(file)
    expect(Object.keys(entries).sort()).toEqual(['data.json', `photos/${photoId}.webp`])
    // 原始位元組，不是 base64
    expect(Array.from(entries[`photos/${photoId}.webp`]!)).toEqual([9, 8, 7])
  })

  it('leaves photos out unless asked', async () => {
    const photos = await collectPhotos(snapshot, blobs)
    const file = await buildExport(snapshot, csv, photos, { json: true, csv: true, includePhotos: false }, when)
    expect(Object.keys(await entriesOf(file)).some((n) => n.startsWith('photos/'))).toBe(false)
  })

  it('refuses when no format is chosen', async () => {
    await expect(buildExport(snapshot, csv, new Map(), { json: false, csv: false, includePhotos: true }, when)).rejects.toThrow()
  })
})

describe('readImport', () => {
  it('reads a plain JSON backup', async () => {
    const result = await readImport(new File([JSON.stringify({ hello: 1 })], 'backup.json'))
    expect(result).toMatchObject({ raw: { hello: 1 }, hadArchive: false })
    expect(result.photos.size).toBe(0)
  })

  // 從通訊軟體存下來的檔案常被改名：依檔頭判斷，不看副檔名
  it('recognises a zip by its header even when the name says otherwise', async () => {
    const zipped = zipSync({ 'data.json': strToU8('{"x":2}') })
    const result = await readImport(new File([zipped], 'backup.json'))
    expect(result).toMatchObject({ raw: { x: 2 }, hadArchive: true })
  })

  it('reads photos out of the archive with their type', async () => {
    const zipped = zipSync({ 'data.json': strToU8('{}'), 'photos/abc.jpg': new Uint8Array([1]) })
    const { photos } = await readImport(new File([zipped], 'b.zip'))
    expect(photos.get('abc')?.type).toBe('image/jpeg')
  })

  // CSV 只供分析，不能匯入（規格 13.2.1）
  it('refuses an archive that only holds CSV', async () => {
    const zipped = zipSync({ 'expenses.csv': strToU8('a') })
    await expect(readImport(new File([zipped], 'x.zip'))).rejects.toMatchObject({ name: 'SnapshotError' })
  })

  it('refuses a file that is neither JSON nor zip', async () => {
    await expect(readImport(new File(['date,amount\r\n'], 'x.csv'))).rejects.toMatchObject({ name: 'SnapshotError' })
  })
})

describe('importArchive', () => {
  it('restores data and photos from a full archive', async () => {
    const photos = await collectPhotos(snapshot, blobs)
    const file = await buildExport(snapshot, null, photos, { json: true, csv: false, includePhotos: true }, when)

    const name = freshDbName()
    const repo2 = await IdbTripRepository.open(name, { now: tickingClock() })
    const blobs2 = await IdbBlobStore.open(name)
    const report = await importArchive(file, repo2, blobs2, 'replace')
    expect(report).toEqual({ photosRestored: 1, photosMissing: 0 })
    expect((await repo2.listExpenses('t1')).map((e) => e.id)).toEqual(['e1'])
    expect(Array.from(new Uint8Array(await (await blobs2.get(photoId))!.arrayBuffer()))).toEqual([9, 8, 7])
    repo2.close()
    blobs2.close()
  })

  // 純 JSON 備份：帳務還原，照片算作缺少，UI 據此顯示佔位
  it('restores data from a JSON backup and reports the photos as missing', async () => {
    const file = await buildExport(snapshot, null, new Map(), { json: true, csv: false, includePhotos: false }, when)
    const name = freshDbName()
    const repo2 = await IdbTripRepository.open(name, { now: tickingClock() })
    const blobs2 = await IdbBlobStore.open(name)
    expect(await importArchive(file, repo2, blobs2, 'replace')).toEqual({ photosRestored: 0, photosMissing: 1 })
    repo2.close()
    blobs2.close()
  })

  // 帳務驗證失敗時，一張照片都不能留下
  it('writes no photos when the data is refused', async () => {
    const bad = { ...snapshot, expenses: [{ ...snapshot.expenses[0]!, paidBy: 'ghost' }] }
    const zipped = zipSync({ 'data.json': strToU8(JSON.stringify(bad)), [`photos/${photoId}.webp`]: new Uint8Array([1]) })
    const name = freshDbName()
    const repo2 = await IdbTripRepository.open(name, { now: tickingClock() })
    const blobs2 = await IdbBlobStore.open(name)
    await expect(importArchive(new File([zipped], 'x.zip'), repo2, blobs2, 'replace')).rejects.toMatchObject({ name: 'SnapshotError' })
    expect(await blobs2.usage()).toEqual({ bytes: 0, count: 0 })
    repo2.close()
    blobs2.close()
  })

  it('refuses a backup made by a newer version before touching anything', async () => {
    const future = zipSync({ 'data.json': strToU8(JSON.stringify({ ...snapshot, schemaVersion: 99 })) })
    await expect(importArchive(new File([future], 'x.zip'), repo, blobs, 'replace')).rejects.toMatchObject({
      problems: ['backup was made by a newer version (v99)'],
    })
  })

  // zip 裡沒被任何支出引用的檔案不進資料庫
  it('ignores photos no expense refers to', async () => {
    const zipped = zipSync({
      'data.json': strToU8(JSON.stringify(snapshot)),
      [`photos/${photoId}.webp`]: new Uint8Array([1]),
      'photos/stray.webp': new Uint8Array([2]),
    })
    const name = freshDbName()
    const repo2 = await IdbTripRepository.open(name, { now: tickingClock() })
    const blobs2 = await IdbBlobStore.open(name)
    await importArchive(new File([zipped], 'x.zip'), repo2, blobs2, 'replace')
    expect(await blobs2.get('stray')).toBeUndefined()
    expect((await blobs2.usage()).count).toBe(1)
    repo2.close()
    blobs2.close()
  })
})

describe('collectPhotos', () => {
  it('skips photos of deleted expenses', async () => {
    await repo.deleteExpense('e1')
    expect((await collectPhotos(await repo.exportSnapshot(), blobs)).size).toBe(0)
  })

  it('round-trips the JSON through the export untouched', async () => {
    const file = await buildExport(snapshot, null, new Map(), { json: true, csv: false, includePhotos: false }, when)
    expect(JSON.parse(strFromU8(new Uint8Array(await file.arrayBuffer())))).toEqual(snapshot)
  })
})
