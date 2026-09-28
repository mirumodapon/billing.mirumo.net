import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { t, tPlural } from '../../i18n'
import { confirmDelete } from '../../test/confirmDelete'
import { makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

const onsen = { id: 'onsen', name: '溫泉', icon: 'IconBeach', colorKey: 'accent2' as const }

async function setup(options: { used?: boolean } = {}) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', categories: [onsen] }))
  if (options.used) await stores.repo.saveExpense(makeExpense({ tripId: 't1', categoryId: 'onsen' }))
  const app = await renderApp('/trip/t1/setup', stores)
  await app.user.click(screen.getByRole('button', { name: new RegExp(`^${t('tripCategories.title')}`) }))
  return { ...app, panel: within(screen.getByTestId('section-trip-categories-panel')) }
}

const own = async (stores: Awaited<ReturnType<typeof setup>>['stores']) => (await stores.repo.getTrip('t1'))!.categories

describe('TripCategoriesSection (task#114)', () => {
  it('adds a category for this trip only, with an icon and a colour', async () => {
    const { user, panel, stores } = await setup()
    await user.click(panel.getByRole('button', { name: t('settings.addCategory') }))
    const sheet = within(screen.getByRole('dialog', { name: t('settings.addCategory') }))
    await user.type(sheet.getByLabelText(t('settings.categoryName')), '滑雪')
    await user.click(sheet.getByRole('radio', { name: 'Gift' }))
    await user.click(sheet.getByRole('button', { name: t('settings.save') }))
    await waitFor(async () => expect((await own(stores))?.map((c) => c.name)).toEqual(['溫泉', '滑雪']))
    expect((await own(stores))?.at(-1)).toMatchObject({ icon: 'IconGift' })
    // 全域設定不受影響
    expect((await stores.repo.getSettings()).categories.some((c) => c.name === '滑雪')).toBe(false)
  })

  it('removes one nobody uses, after confirming', async () => {
    const { user, panel, stores } = await setup()
    await user.click(panel.getByRole('button', { name: t('settings.removeItem', { name: '溫泉' }) }))
    await confirmDelete(user, '溫泉')
    await waitFor(async () => expect(await own(stores)).toEqual([]))
  })

  it('keeps one this trip’s expenses use, and says how many', async () => {
    const { panel } = await setup({ used: true })
    expect(panel.getByText(tPlural('settings.usedBy', { count: 1 }))).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: t('settings.removeItem', { name: '溫泉' }) })).not.toBeInTheDocument()
  })
})

describe('trip categories in the expense form (task#114)', () => {
  it('offers the trip’s own categories next to the global ones', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1', categories: [onsen] }))
    const { user } = await renderApp('/trip/t1/expense/new', stores)
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    const panel = within(screen.getByTestId('section-details-panel'))
    expect(panel.getByRole('radio', { name: '溫泉' })).toBeInTheDocument()
    expect(panel.getByRole('radio', { name: t('cat.food') })).toBeInTheDocument()
  })
})
