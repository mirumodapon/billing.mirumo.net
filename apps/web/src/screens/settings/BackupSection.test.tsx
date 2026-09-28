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
