import type { TripBudget } from '@billing/core'
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../../data/session'
import { makeTrip } from '../../data/testing/fixtures'
import { formatMoney } from '../../i18n/format'
import { t } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

async function setup(budget: TripBudget = { scope: 'self' }) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD', budget }))
  const app = await renderApp('/trip/t1/setup', stores)
  const header = () => screen.getByRole('button', { name: new RegExp(`^${t('budget.title')}`) })
  await app.user.click(header())
  return { ...app, header, panel: within(screen.getByTestId('section-budget-panel')) }
}

const saved = async (stores: Awaited<ReturnType<typeof setup>>['stores']) => (await stores.repo.getTrip('t1'))!.budget
const key = (name: string) => screen.getByRole('button', { name })

describe('BudgetSection', () => {
  it('sets a total budget', async () => {
    const { user, panel, stores } = await setup()
    await user.click(panel.getByRole('button', { name: new RegExp(t('budget.total')) }))
    for (const k of ['5', '0', '000']) await user.click(key(k))
    await user.click(key(t('keypad.done')))
    await waitFor(async () => expect((await saved(stores)).total).toBe(50000))
  })

  // 規格 2.2：未設為 undefined，不用 0；欄位直接不存在，與匯出後讀回的形狀一致
  it('removes the budget field when cleared', async () => {
    const { user, panel, stores } = await setup({ total: 30000, daily: 5000, scope: 'self' })
    await user.click(panel.getByRole('button', { name: new RegExp(t('budget.total')) }))
    await user.click(key(t('keypad.clear')))
    await user.click(key(t('keypad.done')))
    await waitFor(async () => expect('total' in (await saved(stores))).toBe(false))
    expect(await saved(stores)).toEqual({ daily: 5000, scope: 'self' })
  })

  it('switches whose spending counts', async () => {
    const { user, panel, stores } = await setup()
    await user.click(panel.getByRole('radio', { name: t('budget.scopeGroup') }))
    await waitFor(async () => expect((await saved(stores)).scope).toBe('group'))
  })

  it('summarises the budget while closed', async () => {
    const { header, user } = await setup({ total: 30000, scope: 'self' })
    await user.click(header())
    expect(header()).toHaveTextContent(formatMoney(30000, 'TWD').replace(/\s+/g, ' '))
  })

  it('says there is no budget when none is set', async () => {
    const { header } = await setup()
    expect(header()).toHaveTextContent(t('budget.summaryNone'))
  })
})
