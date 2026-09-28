import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { makeExpense, makeTrip } from '../data/testing/fixtures'
import { APP_ID, SNAPSHOT_VERSION, type Snapshot } from '../data/types'
import { t } from '../i18n'
import { makeStores } from '../test/renderApp'
import { csvNamesFor, estimateExportBytes, LAST_EXPORT_KEY, lastExportAt, previewImport, runExport } from './backup'

beforeEach(() => localStorage.clear())

const trip = makeTrip({
  id: 't1',
  categories: [{ id: 'ski', name: '滑雪', icon: 'IconBeach', colorKey: 'accent3' }],
  paymentMethods: [{ id: 'suica', name: 'Suica' }],
})

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    schemaVersion: SNAPSHOT_VERSION,
    exportedAt: '2026-03-20T00:00:00.000Z',
    app: APP_ID,
    settings: defaultSettings(),
    trips: [trip],
    expenses: [],
    transfers: [],
    ...overrides,
  } as Snapshot
}

describe('csvNamesFor (task#117)', () => {
  const names = csvNamesFor(defaultSettings())

  it('names built-in categories and payment methods in the current language', () => {
    expect(names.category('cat.food', trip)).toBe(t('cat.food'))
    expect(names.paymentMethod('pay.cash', trip)).toBe(t('pay.cash'))
  })

  it('names the trip’s own categories and payment methods', () => {
    expect(names.category('ski', trip)).toBe('滑雪')
    expect(names.paymentMethod('suica', trip)).toBe('Suica')
  })

  it('falls back to the id when nothing matches', () => {
    expect(names.category('ski', makeTrip())).toBe('ski')
  })
})

describe('estimateExportBytes (spec 4.8)', () => {
  const withPhoto = snapshot({
    expenses: [makeExpense({ attachments: [{ id: 'p', mimeType: 'image/webp', byteSize: 150_000, width: 1, height: 1 }] })],
  })

  it('grows with photos only when they are included', () => {
    const without = estimateExportBytes(withPhoto, { json: true, csv: false, includePhotos: false })
    const withPhotos = estimateExportBytes(withPhoto, { json: true, csv: false, includePhotos: true })
    expect(withPhotos - without).toBe(150_000)
  })

  it('counts both formats when both are chosen', () => {
    const json = estimateExportBytes(withPhoto, { json: true, csv: false, includePhotos: false })
    const both = estimateExportBytes(withPhoto, { json: true, csv: true, includePhotos: false })
    expect(both).toBeGreaterThan(json)
  })

  // 刪掉的支出不匯出照片，也不該算進大小
  it('leaves out photos of deleted expenses', () => {
    const deleted = snapshot({
      expenses: [makeExpense({ deletedAt: '2026-03-18T00:00:00.000Z', attachments: [{ id: 'p', mimeType: 'image/webp', byteSize: 150_000, width: 1, height: 1 }] })],
    })
    const a = estimateExportBytes(deleted, { json: true, csv: false, includePhotos: false })
    const b = estimateExportBytes(deleted, { json: true, csv: false, includePhotos: true })
    expect(b).toBe(a)
  })
})

describe('runExport', () => {
  it('hands the file over and remembers when the backup was made', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(trip)
    const deliver = vi.fn<(file: File) => Promise<'shared'>>(async () => 'shared')
    const now = new Date('2026-03-20T10:00:00.000Z')
    await runExport(stores, defaultSettings(), { json: true, csv: false, includePhotos: false }, deliver, now)
    const file = deliver.mock.calls[0]![0]
    expect(file.name).toMatch(/\.json$/)
    expect(lastExportAt()).toBe(now.toISOString())
    expect(localStorage.getItem(LAST_EXPORT_KEY)).toBe(now.toISOString())
  })

  // 使用者在分享面板按取消：沒有拿到備份，不能算匯出過
  it('does not count a cancelled share as a backup', async () => {
    const stores = await makeStores()
    await runExport(stores, defaultSettings(), { json: true, csv: true, includePhotos: false }, async () => 'cancelled' as const)
    expect(lastExportAt()).toBeUndefined()
  })
})

describe('previewImport (Plan 10 P3)', () => {
  const photo = { id: 'p', mimeType: 'image/webp', byteSize: 1, width: 1, height: 1 }
  const file = (content: unknown) => new File([JSON.stringify(content)], 'backup.json', { type: 'application/json' })

  it('sums up a valid backup without writing anything', async () => {
    const snap = snapshot({ expenses: [makeExpense({ attachments: [photo] }), makeExpense({ id: 'e2' })] })
    expect(await previewImport(file(snap))).toEqual({ ok: true, trips: 1, expenses: 2, photos: 1 })
  })

  it('lists the problems of a broken backup', async () => {
    const result = await previewImport(file({ ...snapshot(), trips: 'nope' }))
    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.problems.length).toBeGreaterThan(0)
  })

  it('refuses a file that is not a backup at all', async () => {
    expect((await previewImport(new File(['hello'], 'notes.txt'))).ok).toBe(false)
  })
})
