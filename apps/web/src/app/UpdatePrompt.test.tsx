import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../data/session'
import { makeTrip } from '../data/testing/fixtures'
import { t } from '../i18n'
import { makeStores, renderApp } from '../test/renderApp'
import { announceUpdate, resetUpdate, updateServiceWorker } from '../test/pwaRegisterStub'

beforeEach(() => clearSession())
afterEach(() => resetUpdate())

describe('UpdatePrompt (spec 7.6)', () => {
  it('stays quiet until a new version is ready', async () => {
    await renderApp('/')
    expect(screen.queryByText(t('update.available'))).not.toBeInTheDocument()
  })

  // registerType 是 prompt：不自動重載，由使用者按「立即更新」
  it('offers the update and applies it only when asked', async () => {
    const { user } = await renderApp('/')
    announceUpdate()
    expect(await screen.findByText(t('update.available'))).toBeInTheDocument()
    expect(updateServiceWorker).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: t('update.now') }))
    await waitFor(() => expect(updateServiceWorker).toHaveBeenCalledWith(true))
  })

  // task#90：重載前把填到一半的表單寫進草稿，最後 300ms 內打的字也不能丟
  it('saves the form being filled in before reloading', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1' }))
    const { user } = await renderApp('/trip/t1/expense/new', stores)
    await user.type(screen.getByLabelText(t('expense.description')), '拉麵')
    announceUpdate()
    await user.click(await screen.findByRole('button', { name: t('update.now') }))
    await waitFor(() => expect(updateServiceWorker).toHaveBeenCalled())
    const saved = await stores.drafts.load('/trip/t1/expense/new')
    expect((saved?.value as { description: string }).description).toBe('拉麵')
  })

  // task#141：snackbar 關掉之後，設定頁的「關於」仍然可以立即更新
  it('offers the update in About too, even after the notice is gone', async () => {
    const stores = await makeStores()
    const { user } = await renderApp('/settings', stores)
    const about = () => within(screen.getByRole('region', { name: t('about.title') }))
    expect(about().queryByRole('button', { name: t('update.now') })).not.toBeInTheDocument()
    announceUpdate()
    act(() => stores.ui.getState().dismiss('update'))
    await user.click(await about().findByRole('button', { name: t('update.now') }))
    await waitFor(() => expect(updateServiceWorker).toHaveBeenCalledWith(true))
  })
})
