import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, readSession, writeSession } from '../../data/session'
import { makeTrip } from '../../data/testing/fixtures'
import { t } from '../../i18n'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'
import { confirmDelete } from '../../test/confirmDelete'

beforeEach(() => clearSession())

async function setup() {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京' }))
  const app = await renderApp('/trip/t1/setup', stores)
  // 標題與面板裡的按鈕同名；jsdom 不支援 inert，收起的面板也找得到，所以挑有 aria-expanded 的那個
  const header = screen.getAllByRole('button', { name: new RegExp(`^${t('setup.delete')}`) }).find((b) => b.hasAttribute('aria-expanded'))!
  await app.user.click(header)
  const panel = within(screen.getByTestId('section-delete-panel'))
  return { ...app, deleteButton: () => panel.getByRole('button', { name: t('setup.delete') }) }
}

describe('DeleteTripSection', () => {
  it('deletes the trip once confirmed and returns to the list', async () => {
    const { user, stores, deleteButton } = await setup()
    await user.click(deleteButton())
    await confirmDelete(user, '東京')
    await waitFor(() => expect(currentRoute()).toBe('/'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(async () => expect(await stores.repo.getTrip('t1')).toBeUndefined())
    expect(await screen.findByRole('button', { name: t('common.undo') })).toBeInTheDocument()
  })

  it('leaves no extra history entry behind', async () => {
    const { user, deleteButton } = await setup()
    const before = history.length
    await user.click(deleteButton())
    await confirmDelete(user, '東京')
    await waitFor(() => expect(currentRoute()).toBe('/'))
    expect(history.length).toBe(before)
  })

  it('brings the trip back to the list on undo', async () => {
    const { user, deleteButton } = await setup()
    await user.click(deleteButton())
    await confirmDelete(user, '東京')
    await user.click(await screen.findByRole('button', { name: t('common.undo') }))
    expect(await screen.findByRole('heading', { name: '東京' })).toBeInTheDocument()
    expect(currentRoute()).toBe('/')
  })

  // 規格 12 最後一條：刪除當前旅程後重開 App，靜默退回旅程列表不報錯
  it('opens quietly on the list after a restart, even if the session still points at the trip', async () => {
    const { user, stores, deleteButton } = await setup()
    await user.click(deleteButton())
    await confirmDelete(user, '東京')
    await waitFor(async () => expect(await stores.repo.getTrip('t1')).toBeUndefined())
    cleanup()
    writeSession({ route: '/trip/t1/setup', tripId: 't1' })
    const restarted = await renderApp('/trip/t1/setup', { ...stores, ui: (await makeStores()).ui })
    await waitFor(() => expect(currentRoute()).toBe('/'))
    expect(readSession()?.route).toBe('/')
    expect(restarted.stores.ui.getState().queue).toEqual([])
  })
})
