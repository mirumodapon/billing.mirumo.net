import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { lastExportAt } from '../../domain/backup'
import { t } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => {
  clearSession()
  localStorage.clear()
  // jsdom 沒有分享面板：匯出走下載，要有 object URL
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:export'), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openExport() {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
  await stores.repo.saveTrip(makeTrip({ id: 't1' }))
  await stores.repo.saveExpense(makeExpense({ tripId: 't1', attachments: [{ id: 'p', mimeType: 'image/webp', byteSize: 2_000_000, width: 1, height: 1 }] }))
  const app = await renderApp('/settings', stores)
  await app.user.click(screen.getByRole('button', { name: t('backup.export') }))
  return { ...app, sheet: within(screen.getByRole('dialog', { name: t('backup.export') })) }
}

describe('BackupSection: export (spec 4.8)', () => {
  it('explains that the data lives only on this device', async () => {
    await renderApp('/settings')
    expect(screen.getByRole('region', { name: t('backup.title') })).toHaveTextContent(t('backup.hint'))
  })

  // 按下去之前就知道會拿到多大的檔案：照片 2 MB，開了就看得到量級跳上去
  it('shows an estimated size that follows the photo switch', async () => {
    const { user, sheet } = await openExport()
    const estimate = () => sheet.getByTestId('export-estimate').textContent ?? ''
    await waitFor(() => expect(estimate()).toMatch(/KB/))
    await user.click(sheet.getByRole('button', { name: t('backup.includePhotos') }))
    expect(estimate()).toMatch(/MB/)
  })

  it('exports, says so and remembers the backup', async () => {
    const { user, sheet } = await openExport()
    await user.click(sheet.getByRole('button', { name: t('backup.exportNow') }))
    expect(await screen.findByText(t('backup.exported'))).toBeInTheDocument()
    expect(lastExportAt()).toBeDefined()
    expect(screen.queryByRole('dialog', { name: t('backup.export') })).not.toBeInTheDocument()
  })

  it('tells CSV apart from a restorable backup', async () => {
    const { user, sheet } = await openExport()
    await user.click(sheet.getByRole('radio', { name: t('backup.formatCsv') }))
    expect(sheet.getByText(t('backup.csvHint'))).toBeInTheDocument()
  })
})

describe('BackupSection: import (Plan 10 P3/P4)', () => {
  /** 另一台裝置匯出的備份：一趟「大阪」 */
  async function backupFile() {
    const other = await makeStores()
    // 取代會連設定一起換掉：備份也用中文，否則語言跟著變、訊息就對不上
    await other.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
    await other.repo.saveTrip(makeTrip({ id: 'osaka', name: '大阪' }))
    return new File([JSON.stringify(await other.repo.exportSnapshot())], 'backup.json', { type: 'application/json' })
  }

  async function openWith(file: File) {
    const stores = await makeStores()
    await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
    await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京' }))
    const app = await renderApp('/settings', stores)
    await app.user.upload(screen.getByTestId('import-input'), file)
    return { ...app, sheet: within(await screen.findByRole('dialog', { name: t('backup.import') })) }
  }

  it('sums up the backup, then merges it in next to what is here', async () => {
    const { user, sheet, stores } = await openWith(await backupFile())
    expect(sheet.getByTestId('import-summary')).toHaveTextContent(t('backup.importSummary', { trips: 1, expenses: 0, photos: 0 }))
    await user.click(sheet.getByRole('button', { name: t('backup.merge') }))
    // 匯入要寫整份資料庫，整套測試一起跑時比預設的 1 秒久
    expect(await screen.findByText(t('backup.imported'), undefined, { timeout: 5000 })).toBeInTheDocument()
    expect((await stores.repo.listTrips()).map((trip) => trip.name).sort()).toEqual(['大阪', '東京'])
    // store 重新載入：不必重開 app 就看得到
    expect(stores.trips.getState().trips.map((trip) => trip.name).sort()).toEqual(['大阪', '東京'])
  })

  // 取代會清掉現有的帳：多確認一次，取消就什麼都不做
  it('asks before replacing, and replaces only once confirmed', async () => {
    const { user, sheet, stores } = await openWith(await backupFile())
    await user.click(sheet.getByRole('button', { name: t('backup.replace') }))
    const dialog = within(screen.getByRole('dialog', { name: t('backup.replaceTitle') }))
    await user.click(dialog.getByRole('button', { name: t('common.cancel') }))
    expect((await stores.repo.listTrips()).map((trip) => trip.name)).toEqual(['東京'])
    await user.click(sheet.getByRole('button', { name: t('backup.replace') }))
    await user.click(within(screen.getByRole('dialog', { name: t('backup.replaceTitle') })).getByRole('button', { name: t('backup.replace') }))
    // 匯入要寫整份資料庫，整套測試一起跑時比預設的 1 秒久
    expect(await screen.findByText(t('backup.imported'), undefined, { timeout: 5000 })).toBeInTheDocument()
    expect((await stores.repo.listTrips()).map((trip) => trip.name)).toEqual(['大阪'])
  })

  it('explains why a broken file cannot be imported, and writes nothing', async () => {
    const { sheet, stores } = await openWith(new File(['{"hello":1}'], 'x.json', { type: 'application/json' }))
    expect(sheet.getByRole('alert')).toHaveTextContent(t('backup.importInvalid'))
    expect(sheet.queryByRole('button', { name: t('backup.merge') })).not.toBeInTheDocument()
    expect((await stores.repo.listTrips()).map((trip) => trip.name)).toEqual(['東京'])
  })
})
