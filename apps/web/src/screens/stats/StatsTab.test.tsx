import type { Trip } from '@billing/core'
import { cleanup, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession, readSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { formatMoney } from '../../i18n/format'
import { t } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

const plain = (s: string) => s.replace(/\s+/g, ' ')

/** 與 statsView.test 同一個手算情境：全團 4,200、我 1,000 */
async function setup(trip: Partial<Trip> = {}) {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
  await stores.repo.saveTrip(makeTrip({ id: 't1', startDate: '2026-03-14', endDate: '2026-03-16', ...trip }))
  await stores.repo.saveExpense(
    makeExpense({ id: 'e1', tripId: 't1', date: '2026-03-14', description: '晚餐', paidBy: 'a', amount: 3000, currency: 'TWD', exchangeRate: 1, categoryId: 'cat.food', split: { mode: 'even', participants: ['a', 'b', 'c'] } }),
  )
  await stores.repo.saveExpense(
    makeExpense({ id: 'e2', tripId: 't1', date: '2026-03-15', description: '地鐵', paidBy: 'b', amount: 1200, currency: 'TWD', exchangeRate: 1, categoryId: 'cat.transport', split: { mode: 'even', participants: ['b', 'c'] } }),
  )
  const app = await renderApp('/trip/t1/stats', stores)
  return { ...app, scope: () => within(screen.getByRole('radiogroup', { name: t('stats.scope') })) }
}

const total = () => screen.getByTestId('stats-total')

describe('StatsTab: scope (spec 4.5, Plan 9 T1)', () => {
  it('starts on the group, the same figure as the expense list', async () => {
    const { scope } = await setup()
    expect(scope().getByRole('radio', { name: t('stats.group') })).toBeChecked()
    expect(total()).toHaveTextContent(plain(t('stats.total', { amount: formatMoney(4200, 'TWD') })))
  })

  it('switches to my share and remembers it', async () => {
    const { user, scope, stores } = await setup()
    await user.click(scope().getByRole('radio', { name: t('stats.self') }))
    expect(total()).toHaveTextContent(plain(t('stats.total', { amount: formatMoney(1000, 'TWD') })))
    expect(readSession()?.statsScope).toBe('self')
    cleanup()
    await renderApp('/trip/t1/stats', stores)
    expect(within(screen.getByRole('radiogroup', { name: t('stats.scope') })).getByRole('radio', { name: t('stats.self') })).toBeChecked()
  })
})
