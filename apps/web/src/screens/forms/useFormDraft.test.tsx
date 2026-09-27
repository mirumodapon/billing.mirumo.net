import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { t } from '../../i18n'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

const NEW = '/trip/t1/expense/new'

beforeEach(() => clearSession())
afterEach(() => setVisibility('visible'))

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function setup(route = NEW) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1' }))
  await stores.repo.saveExpense(makeExpense({ id: 'e1', tripId: 't1', description: '一蘭拉麵' }))
  return renderApp(route, stores)
}

const description = () => screen.getByLabelText(t('expense.description'))
const saved = async (stores: Awaited<ReturnType<typeof setup>>['stores'], route = NEW) =>
  (await stores.drafts.load(route))?.value as { description?: string } | undefined

describe('expense drafts (spec 7.9)', () => {
  it('saves what is typed a moment later', async () => {
    const { user, stores } = await setup()
    await user.type(description(), '拉麵')
    await waitFor(async () => expect((await saved(stores))?.description).toBe('拉麵'))
  })

  // iOS 上唯一可靠的「即將離開」訊號：最後 300ms 打的字不能丟
  it('writes at once when the app goes to the background', async () => {
    const { user, stores } = await setup()
    await user.type(description(), '拉麵')
    await act(async () => setVisibility('hidden'))
    expect((await saved(stores))?.description).toBe('拉麵')
  })

  it('brings the draft back on return and says so', async () => {
    const { user, stores } = await setup()
    await user.type(description(), '拉麵')
    await act(async () => setVisibility('hidden'))
    cleanup()
    setVisibility('visible')
    await renderApp(NEW, stores)
    expect(description()).toHaveValue('拉麵')
    expect(screen.getByTestId('draft-banner')).toHaveTextContent(t('draft.restored'))
  })

  it('throws the restored draft away on request', async () => {
    const { user, stores } = await setup()
    await user.type(description(), '拉麵')
    await act(async () => setVisibility('hidden'))
    cleanup()
    setVisibility('visible')
    const again = await renderApp(NEW, stores)
    await again.user.click(within(screen.getByTestId('draft-banner')).getByRole('button', { name: t('draft.discard') }))
    expect(description()).toHaveValue('')
    expect(screen.queryByText(t('draft.restored'))).not.toBeInTheDocument()
    await waitFor(async () => expect(await saved(stores)).toBeUndefined())
  })

  // Plan 5 找到的缺口：存檔後切到背景，不能把草稿寫回去
  it('is gone once the expense is saved, even if the app is then backgrounded', async () => {
    const { user, stores } = await setup('/trip/t1/expense/e1/edit')
    await user.type(description(), '！')
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    await act(async () => setVisibility('hidden'))
    expect(await saved(stores, '/trip/t1/expense/e1/edit')).toBeUndefined()
  })

  it('leaves at once without asking when nothing was changed', async () => {
    const { user, stores } = await setup()
    await user.click(screen.getByRole('button', { name: t('form.close') }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect(await saved(stores)).toBeUndefined()
  })

  it('asks before leaving a changed form, and keeps the draft when asked to', async () => {
    const { user, stores } = await setup()
    await user.type(description(), '拉麵')
    await user.click(screen.getByRole('button', { name: t('form.close') }))
    const dialog = screen.getByRole('dialog', { name: t('draft.leaveTitle') })
    await user.click(within(dialog).getByRole('button', { name: t('draft.keep') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect((await saved(stores))?.description).toBe('拉麵')
  })

  it('discards the draft when asked to', async () => {
    const { user, stores } = await setup()
    await user.type(description(), '拉麵')
    await user.click(screen.getByRole('button', { name: t('form.close') }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('draft.discard') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect(await saved(stores)).toBeUndefined()
  })

  // 誤按 Escape 或點到背景：寧可留下草稿，不能丟資料
  it('keeps the draft when the question is dismissed', async () => {
    const { user, stores } = await setup()
    await user.type(description(), '拉麵')
    await user.click(screen.getByRole('button', { name: t('form.close') }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect((await saved(stores))?.description).toBe('拉麵')
  })

  it('ignores a draft it cannot read, and removes it', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1' }))
    await stores.drafts.save(NEW, { amount: 'x' })
    await renderApp(NEW, stores)
    expect(description()).toHaveValue('')
    expect(screen.queryByText(t('draft.restored'))).not.toBeInTheDocument()
    await waitFor(async () => expect(await stores.drafts.load(NEW)).toBeUndefined())
  })

  it('keeps new and edit drafts apart', async () => {
    const { user, stores } = await setup('/trip/t1/expense/e1/edit')
    await user.type(description(), '！')
    await act(async () => setVisibility('hidden'))
    expect((await saved(stores, '/trip/t1/expense/e1/edit'))?.description).toBe('一蘭拉麵！')
    expect(await saved(stores, NEW)).toBeUndefined()
  })
})
