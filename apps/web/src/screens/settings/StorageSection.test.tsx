import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { formatBytes } from '../../i18n/format'
import { t, tPlural } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())
afterEach(() => Reflect.deleteProperty(navigator, 'storage'))

function fakeStorage(usage: number, quota: number) {
  Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ usage, quota }) }, configurable: true })
}

async function open() {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
  await stores.blobs.put(new Blob(['x']))
  await stores.blobs.put(new Blob(['y']))
  await renderApp('/settings', stores)
  return within(screen.getByRole('region', { name: t('storage.title') }))
}

describe('StorageSection (spec 7.4)', () => {
  it('shows how much is used, of how much, and how many photos', async () => {
    fakeStorage(4_000_000, 100_000_000)
    const section = await open()
    expect(await section.findByTestId('storage-usage')).toHaveTextContent(t('storage.used', { used: formatBytes(4_000_000), quota: formatBytes(100_000_000) }))
    expect(await section.findByText(tPlural('storage.photos', { count: 2 }))).toBeInTheDocument()
    expect(section.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('warns once 80% is used', async () => {
    fakeStorage(85, 100)
    const section = await open()
    expect(await section.findByRole('alert')).toHaveTextContent(t('storage.nearlyFull'))
  })

  // 瀏覽器不給估計值（舊版 Safari）：不顯示用量，照片張數照常
  it('still counts photos when the browser gives no estimate', async () => {
    const section = await open()
    await waitFor(() => expect(section.getByText(tPlural('storage.photos', { count: 2 }))).toBeInTheDocument())
    expect(section.queryByTestId('storage-usage')).not.toBeInTheDocument()
  })
})
