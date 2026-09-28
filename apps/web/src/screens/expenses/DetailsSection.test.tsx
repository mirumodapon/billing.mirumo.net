import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeTrip } from '../../data/testing/fixtures'
import { pickDate } from '../../test/pickDate'
import { t } from '../../i18n'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

async function openNew() {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW', lastUsed: { currency: 'JPY', paymentMethodId: 'pay.credit', categoryId: 'cat.food' } })
  await stores.repo.saveTrip(
    makeTrip({ id: 't1', startDate: '2026-03-14', endDate: '2026-03-16', rates: { default: { JPY: 0.21 }, byMethod: { 'JPY|pay.cash': 0.215 } } }),
  )
  const app = await renderApp('/trip/t1/expense/new', stores)
  const header = () => screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) })
  return { ...app, header, panel: () => within(screen.getByTestId('section-details-panel')) }
}

describe('DetailsSection', () => {
  // 預設值夠準才不必展開：收折時就要看得到帶入了什麼
  // 類別不帶入（每一筆自己選）：收折時的摘要只有帶入的付款方式與付款人
  it('summarises the payment method and payer while closed, with no category chosen yet', async () => {
    const { header } = await openNew()
    expect(header()).toHaveTextContent(`${t('pay.credit')}・阿明`)
    expect(header()).not.toHaveTextContent(t('cat.food'))
  })

  it('re-applies the rate for the chosen payment method', async () => {
    const { user, header, panel } = await openNew()
    await user.click(header())
    await user.click(panel().getByRole('radio', { name: t('pay.cash') }))
    expect(screen.getByText(new RegExp(t('expense.rateInline', { rate: '0.215' }).replace('.', '\\.')))).toBeInTheDocument()
  })

  it('records who paid and when', async () => {
    const { user, header, panel, stores } = await openNew()
    await user.click(header())
    await user.click(within(panel().getByRole('radiogroup', { name: t('expense.paidBy') })).getByRole('radio', { name: '小美' }))
    // task#97：日期欄點開直接是月曆
    await pickDate(user, t('expense.date'), '2026-03-16', panel())
    await user.click(panel().getByRole('radio', { name: t('cat.transport') }))
    // 存下去看實際寫了什麼
    await user.click(screen.getByLabelText(t('expense.amount')))
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByLabelText(t('expense.description')))
    await user.type(screen.getByLabelText(t('expense.description')), '地鐵')
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    // task#121：分攤還是預設的「只有付款人」，換付款人就跟著換成小美
    expect((await stores.repo.listExpenses('t1'))[0]).toMatchObject({ paidBy: 'b', date: '2026-03-16', categoryId: 'cat.transport', split: { mode: 'even', participants: ['b'] } })
  })

  it('opens one section at a time', async () => {
    const { user, header } = await openNew()
    await user.click(header())
    expect(header()).toHaveAttribute('aria-expanded', 'true')
    await user.click(header())
    expect(header()).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('form sections', () => {
  // 規格 4.4：收折後的預設狀態。上一筆展開過某個區塊，下一筆仍從全部收起開始
  it('start closed on every new form, whatever the last one had open', async () => {
    const { user, header } = await openNew()
    await user.click(header())
    await user.click(screen.getByRole('button', { name: t('form.close') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    location.hash = '#/trip/t1/expense/new'
    await screen.findByRole('heading', { name: t('expense.new') })
    await waitFor(() => expect(header()).toHaveAttribute('aria-expanded', 'false'))
  })
})
