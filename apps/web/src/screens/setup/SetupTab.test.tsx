import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, readSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { pickDate } from '../../test/pickDate'
import { t } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

async function setup(options: { records?: boolean; trip?: Parameters<typeof makeTrip>[0] } = {}) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京', ...options.trip }))
  if (options.records) await stores.repo.saveExpense(makeExpense({ tripId: 't1' }))
  const app = await renderApp('/trip/t1/setup', stores)
  return app
}


const header = () => screen.getByRole('button', { name: new RegExp(`^${t('setup.basic')}`) })

async function openBasic(user: Awaited<ReturnType<typeof setup>>['user']) {
  await user.click(header())
  return within(screen.getByTestId('section-basic-panel'))
}

describe('SetupTab: details', () => {
  // 規格 13.5 openAccordion：重開 app 停在同一個區塊
  it('remembers the open section across a restart', async () => {
    const { user, stores } = await setup()
    await user.click(header())
    expect(header()).toHaveAttribute('aria-expanded', 'true')
    expect(readSession()?.openAccordion).toBe('basic')
    cleanup()
    await renderApp('/trip/t1/setup', stores)
    expect(header()).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes the section again and forgets it', async () => {
    const { user } = await setup()
    await user.click(header())
    await user.click(header())
    expect(header()).toHaveAttribute('aria-expanded', 'false')
    expect(readSession()?.openAccordion).toBeUndefined()
  })

  it('saves an edited name when the field loses focus', async () => {
    const { user, stores } = await setup()
    const panel = await openBasic(user)
    const field = panel.getByLabelText(t('newTrip.name'))
    await user.clear(field)
    await user.type(field, '大阪')
    await user.tab()
    await waitFor(async () => expect((await stores.repo.getTrip('t1'))?.name).toBe('大阪'))
    expect(screen.getByRole('heading', { level: 1, name: '大阪' })).toBeInTheDocument()
  })

  // 每次存檔都會蓋 updatedAt、觸發列表重排；打字途中不存
  it('saves once per edit, not once per keystroke', async () => {
    const { user, stores } = await setup()
    const panel = await openBasic(user)
    const spy = vi.spyOn(stores.repo, 'saveTrip')
    await user.type(panel.getByLabelText(t('newTrip.destination')), '大阪府')
    expect(spy).not.toHaveBeenCalled()
    await user.tab()
    await waitFor(() => expect(spy).toHaveBeenCalledOnce())
  })

  it('does not save a blank name', async () => {
    const { user, stores } = await setup()
    const panel = await openBasic(user)
    const spy = vi.spyOn(stores.repo, 'saveTrip')
    await user.clear(panel.getByLabelText(t('newTrip.name')))
    await user.tab()
    expect(panel.getByText(t('newTrip.nameRequired'))).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('keeps the dates in order', async () => {
    const { user, stores } = await setup({ trip: { startDate: '2026-03-14', endDate: '2026-03-14' } })
    const panel = await openBasic(user)
    const spy = vi.spyOn(stores.repo, 'saveTrip')
    await pickDate(user, t('newTrip.endDate'), '2026-03-12', panel)
    expect(panel.getByText(t('newTrip.dateOrder'))).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('saves a new end date', async () => {
    const { user, stores } = await setup({ trip: { startDate: '2026-03-14', endDate: '2026-03-14' } })
    const panel = await openBasic(user)
    await pickDate(user, t('newTrip.endDate'), '2026-03-16', panel)
    await waitFor(async () => expect((await stores.repo.getTrip('t1'))?.endDate).toBe('2026-03-16'))
  })

  // Plan 6 D3：每筆的匯率都是對本位幣固化的，有帳目後改本位幣等於全部換錯單位
  it('locks the home currency once the trip has records', async () => {
    const { user } = await setup({ records: true })
    const panel = await openBasic(user)
    expect(panel.queryByRole('button', { name: new RegExp(t('newTrip.baseCurrency')) })).not.toBeInTheDocument()
    expect(panel.getByText(t('setup.baseCurrencyLocked'))).toBeInTheDocument()
  })

  it('lets the home currency change while there are no records', async () => {
    const { user, stores } = await setup()
    const panel = await openBasic(user)
    await user.click(panel.getByRole('button', { name: new RegExp(t('newTrip.baseCurrency')) }))
    await user.click(within(screen.getByRole('dialog', { name: t('newTrip.baseCurrency') })).getByRole('radio', { name: /^JPY/ }))
    await waitFor(async () => expect((await stores.repo.getTrip('t1'))?.baseCurrency).toBe('JPY'))
  })

  it('summarises the details while closed', async () => {
    await setup({ trip: { destination: '日本', baseCurrency: 'TWD' } })
    expect(header()).toHaveTextContent('日本')
    expect(header()).toHaveTextContent('TWD')
  })
})
