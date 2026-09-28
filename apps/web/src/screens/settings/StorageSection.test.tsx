import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { restartApp } from '../../data/clearAll'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeTrip } from '../../data/testing/fixtures'
import { formatBytes } from '../../i18n/format'
import { t, tPlural } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

// jsdom 沒辦法重新載入頁面：清完之後的「重新開始」換成替身
vi.mock('../../data/clearAll', async (original) => ({ ...(await original<typeof import('../../data/clearAll')>()), restartApp: vi.fn() }))

beforeEach(() => {
  clearSession()
  vi.mocked(restartApp).mockClear()
})
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

// task#133：清除所有本機資料。先確認，確認了才清，清完從旅程清單重新開始
describe('clearing all data (task#133)', () => {
  async function withData() {
    const stores = await makeStores()
    await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
    await stores.repo.saveTrip(makeTrip({ id: 't1' }))
    const photo = await stores.blobs.put(new Blob(['x']))
    const app = await renderApp('/settings', stores)
    const section = within(screen.getByRole('region', { name: t('storage.title') }))
    return { ...app, stores, photo, section }
  }

  it('asks first, and cancelling keeps everything', async () => {
    const { user, stores, section } = await withData()
    await user.click(section.getByRole('button', { name: t('storage.clearAll') }))
    const dialog = within(screen.getByRole('dialog', { name: t('storage.clearAllTitle') }))
    expect(dialog.getByText(t('storage.clearAllWarning'))).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: t('common.cancel') }))
    expect(await stores.repo.listTrips()).toHaveLength(1)
    expect(restartApp).not.toHaveBeenCalled()
  })

  it('clears trips, photos and settings once confirmed, then starts over', async () => {
    const { user, stores, photo, section } = await withData()
    await user.click(section.getByRole('button', { name: t('storage.clearAll') }))
    await user.click(within(screen.getByRole('dialog', { name: t('storage.clearAllTitle') })).getByRole('button', { name: t('storage.clearAllConfirm') }))
    await waitFor(() => expect(restartApp).toHaveBeenCalledOnce())
    expect(await stores.repo.listTrips()).toEqual([])
    expect(await stores.blobs.get(photo)).toBeUndefined()
    expect((await stores.repo.getSettings()).locale).not.toBe('zh-TW')
  })
})
