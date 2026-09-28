import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { t, tPlural } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'
import { confirmDelete } from '../../test/confirmDelete'

beforeEach(() => clearSession())

async function setup(options: { used?: boolean } = {}) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', rates: { default: { JPY: 0.21 }, byMethod: {} }, paymentMethods: [{ id: 'suica', name: 'Suica' }] }))
  if (options.used) await stores.repo.saveExpense(makeExpense({ tripId: 't1', paymentMethodId: 'suica' }))
  const app = await renderApp('/trip/t1/setup', stores)
  await app.user.click(screen.getByRole('button', { name: new RegExp(`^${t('tripMethods.title')}`) }))
  return { ...app, panel: within(screen.getByTestId('section-trip-methods-panel')) }
}

const methods = async (stores: Awaited<ReturnType<typeof setup>>['stores']) => (await stores.repo.getTrip('t1'))!.paymentMethods

describe('TripPaymentMethodsSection (task#92)', () => {
  it('adds a payment method for this trip only', async () => {
    const { user, panel, stores } = await setup()
    await user.type(panel.getByLabelText(t('tripMethods.newName')), 'ICOCA')
    await user.click(panel.getByRole('button', { name: t('tripMethods.add') }))
    // 舊旅程第一次改清單時才複製一份全域的（task#120），這趟的 Suica 接在後面
    await waitFor(async () => expect((await methods(stores))?.map((m) => m.id).slice(0, 4)).toEqual(['pay.cash', 'pay.credit', 'pay.mobile', 'suica']))
    expect((await methods(stores))?.at(-1)?.name).toBe('ICOCA')
    expect((await stores.repo.getTrip('t1'))?.ownLists).toBe(true)
    // 全域設定不受影響
    expect((await stores.repo.getSettings()).paymentMethods.map((m) => m.id)).toEqual(['pay.cash', 'pay.credit', 'pay.mobile'])
  })

  it('renames one on blur', async () => {
    const { user, panel, stores } = await setup()
    const field = panel.getByLabelText(t('settings.paymentMethodName', { name: 'Suica' }))
    await user.type(field, ' 卡')
    await user.tab()
    await waitFor(async () => expect((await methods(stores))?.find((m) => m.id === 'suica')?.name).toBe('Suica 卡'))
  })

  it('removes one nobody uses, but keeps one this trip’s expenses use', async () => {
    const unused = await setup()
    await unused.user.click(unused.panel.getByRole('button', { name: t('settings.removeItem', { name: 'Suica' }) }))
    await confirmDelete(unused.user, 'Suica')
    await waitFor(async () => expect((await methods(unused.stores))?.map((m) => m.id)).toEqual(['pay.cash', 'pay.credit', 'pay.mobile']))
  })

  it('says how many expenses use one it will not remove', async () => {
    const { panel } = await setup({ used: true })
    expect(panel.queryByRole('button', { name: t('settings.removeItem', { name: 'Suica' }) })).not.toBeInTheDocument()
    expect(panel.getByText(tPlural('settings.usedBy', { count: 1 }))).toBeInTheDocument()
  })

  // task#120：旅程的清單是完整的一份，內建項目也在，名稱不能改，但這趟用不到可以刪
  it('lists the built-in ones too, read-only, and removes one from this trip only', async () => {
    const { user, panel, stores } = await setup()
    const cash = t('pay.cash')
    expect(panel.queryByLabelText(t('settings.paymentMethodName', { name: cash }))).not.toBeInTheDocument()
    expect(panel.getByTestId('method-pay.cash')).toHaveTextContent(cash)
    await user.click(panel.getByRole('button', { name: t('settings.removeItem', { name: cash }) }))
    await confirmDelete(user, cash)
    await waitFor(async () => expect((await methods(stores))?.map((m) => m.id)).toEqual(['pay.credit', 'pay.mobile', 'suica']))
    expect((await methods(stores))?.[0]).toEqual({ id: 'pay.credit', builtin: true })
    expect((await stores.repo.getSettings()).paymentMethods.map((m) => m.id)).toContain('pay.cash')
  })

  it('shows only the trip’s own list once it has one, whatever the global settings say', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1', ownLists: true, paymentMethods: [{ id: 'suica', name: 'Suica' }] }))
    const { user } = await renderApp('/trip/t1/setup', stores)
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('tripMethods.title')}`) }))
    const panel = within(screen.getByTestId('section-trip-methods-panel'))
    expect(panel.getByLabelText(t('settings.paymentMethodName', { name: 'Suica' }))).toBeInTheDocument()
    expect(panel.queryByTestId('method-pay.cash')).not.toBeInTheDocument()
  })

  it('is offered in the expense form and the rate table of this trip', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('rates.title')}`) }))
    await user.click(within(screen.getByRole('region', { name: 'JPY' })).getByRole('button', { name: t('rates.addMethod') }))
    expect(within(screen.getByRole('dialog', { name: t('rates.addMethod') })).getByRole('radio', { name: 'Suica' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    location.hash = '#/trip/t1/expense/new'
    await screen.findByRole('heading', { name: t('expense.new') })
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    expect(within(screen.getByRole('radiogroup', { name: t('expense.paymentMethod') })).getByRole('radio', { name: 'Suica' })).toBeInTheDocument()
  })
})
