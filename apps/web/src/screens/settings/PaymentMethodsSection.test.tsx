import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { t, tPlural } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

const easyCard = { id: 'easy', name: '悠遊卡', builtin: false }
const spare = { id: 'spare', name: '禮券', builtin: false }

async function setup(options: { usedMethod?: string } = {}) {
  const stores = await makeStores()
  const settings = defaultSettings()
  await stores.repo.saveSettings({ ...settings, locale: 'zh-TW', paymentMethods: [...settings.paymentMethods, easyCard, spare] })
  await stores.repo.saveTrip(makeTrip({ id: 't1' }))
  if (options.usedMethod) await stores.repo.saveExpense(makeExpense({ tripId: 't1', paymentMethodId: options.usedMethod }))
  const app = await renderApp('/settings', stores)
  return { ...app, section: within(screen.getByRole('region', { name: t('settings.paymentMethods') })) }
}

const saved = async (stores: Awaited<ReturnType<typeof setup>>['stores']) => (await stores.repo.getSettings()).paymentMethods

describe('PaymentMethodsSection', () => {
  it('shows built-in methods translated and read-only, custom ones editable', async () => {
    const { section } = await setup()
    expect(section.getByText(t('pay.cash'))).toBeInTheDocument()
    expect(section.queryByLabelText(t('settings.paymentMethodName', { name: t('pay.cash') }))).not.toBeInTheDocument()
    expect(section.getByLabelText(t('settings.paymentMethodName', { name: '悠遊卡' }))).toHaveValue('悠遊卡')
  })

  it('adds a payment method with no icon or colour', async () => {
    const { user, section, stores } = await setup()
    await user.type(section.getByLabelText(t('settings.newPaymentMethod')), 'Suica')
    await user.click(section.getByRole('button', { name: t('settings.addPaymentMethod') }))
    await waitFor(async () => expect((await saved(stores)).at(-1)).toMatchObject({ name: 'Suica', builtin: false }))
    expect(Object.keys((await saved(stores)).at(-1)!).sort()).toEqual(['builtin', 'id', 'name'])
  })

  it('does not add a method without a name', async () => {
    const { user, section, stores } = await setup()
    await user.type(section.getByLabelText(t('settings.newPaymentMethod')), '   ')
    await user.click(section.getByRole('button', { name: t('settings.addPaymentMethod') }))
    expect(await saved(stores)).toHaveLength(5)
  })

  it('renames a custom method on blur, never to a blank name', async () => {
    const { user, section, stores } = await setup()
    const field = section.getByLabelText(t('settings.paymentMethodName', { name: '悠遊卡' }))
    await user.clear(field)
    await user.tab()
    expect(field).toHaveValue('悠遊卡')
    await user.type(field, '2')
    await user.tab()
    await waitFor(async () => expect((await saved(stores)).find((m) => m.id === 'easy')?.name).toBe('悠遊卡2'))
  })

  it('removes an unused custom method', async () => {
    const { user, section, stores } = await setup()
    await user.click(await section.findByRole('button', { name: t('settings.removeItem', { name: '禮券' }) }))
    await waitFor(async () => expect((await saved(stores)).map((m) => m.id)).not.toContain('spare'))
  })

  it('keeps a custom method that expenses still use, and says how many', async () => {
    const { section } = await setup({ usedMethod: 'easy' })
    expect(await section.findByText(tPlural('settings.usedBy', { count: 1 }))).toBeInTheDocument()
    expect(section.queryByRole('button', { name: t('settings.removeItem', { name: '悠遊卡' }) })).not.toBeInTheDocument()
  })
})

describe('PaymentMethodsSection layout (task#93)', () => {
  // 一列列都是名稱：可見標籤只是重複，還讓框和內建列對不齊
  it('names custom rows for assistive tech only', async () => {
    const { section } = await setup()
    expect(section.getByText(t('settings.paymentMethodName', { name: '悠遊卡' }))).toHaveClass('bi-visually-hidden')
    expect(section.getByText(t('settings.newPaymentMethod'), { selector: 'label' })).toHaveClass('bi-visually-hidden')
  })

  // 框的寬度對齊靠每一列都有同樣的尾端欄；實際寬度在瀏覽器量過
  it('gives every row the same trailing slot', async () => {
    const { section } = await setup()
    const rows = section.getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    for (const row of rows) expect(row.querySelector('.app-slot')).not.toBeNull()
  })
})
