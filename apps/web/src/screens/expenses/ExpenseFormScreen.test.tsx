import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { t } from '../../i18n'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

async function setup(route: string) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1' }))
  await stores.repo.saveExpense(makeExpense({ id: 'e1', tripId: 't1', description: '一蘭拉麵' }))
  return renderApp(route, stores)
}

describe('ExpenseFormScreen: frame', () => {
  it('opens a blank new expense with saving blocked until it is filled', async () => {
    await setup('/trip/t1/expense/new')
    expect(screen.getByRole('heading', { name: t('expense.new') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('form.save') })).toBeDisabled()
  })

  it('opens an existing expense for editing', async () => {
    await setup('/trip/t1/expense/e1/edit')
    expect(screen.getByRole('heading', { name: t('expense.edit') })).toBeInTheDocument()
    expect(screen.getByLabelText(t('expense.description'))).toHaveValue('一蘭拉麵')
    expect(screen.getByRole('button', { name: t('form.save') })).toBeEnabled()
  })

  it('saves an edit and leaves the form', async () => {
    const { user, stores } = await setup('/trip/t1/expense/e1/edit')
    const field = screen.getByLabelText(t('expense.description'))
    await user.clear(field)
    await user.type(field, '豚骨拉麵')
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect((await stores.repo.listExpenses('t1')).map((e) => [e.id, e.description])).toEqual([['e1', '豚骨拉麵']])
  })

  // 直接由 session 還原進表單時前面沒有頁面：關閉要去支出列表，不是退出 app
  it('closes to the expenses tab when there is no page to go back to', async () => {
    const { user } = await setup('/trip/t1/expense/new')
    await user.click(screen.getByRole('button', { name: t('form.close') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
  })

  it('returns to the expenses tab for an expense that is not there', async () => {
    await setup('/trip/t1/expense/nope')
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
  })

  it('returns to the trip list for a trip that is not there', async () => {
    await setup('/trip/nope/expense/new')
    await waitFor(() => expect(currentRoute()).toBe('/'))
  })
})

describe('ExpenseFormScreen: acceptance and memory', () => {
  async function tripWithJapan() {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1', rates: { default: { JPY: 0.21 }, byMethod: { 'JPY|pay.cash': 0.215 } } }))
    // 這趟旅程上一筆是日圓：新支出的幣別跟著它（Plan 7 E1）
    await stores.repo.saveExpense(makeExpense({ id: 'e1', tripId: 't1', currency: 'JPY', paymentMethodId: 'pay.credit', exchangeRate: 0.2 }))
    return stores
  }
  const key = (name: string) => screen.getByRole('button', { name })

  /*
   * 規格 §10 第 6 階段的驗收條件：記一筆最少三個動作。
   * 輸入金額 → 輸入說明 → 儲存，不展開任何區塊；分攤是全員均分、匯率是旅程匯率表帶入的值。
   */
  it('records an expense in three actions: amount, description, save', async () => {
    const stores = await tripWithJapan()
    const { user } = await renderApp('/trip/t1/expenses', stores)
    await user.click(screen.getByRole('button', { name: t('expenses.add') }))
    // 1. 金額（開頁就聚焦，鍵盤已經在）
    for (const k of ['3', '8', '0', '0']) await user.click(key(k))
    // 2. 說明
    await user.click(screen.getByLabelText(t('expense.description')))
    await user.type(screen.getByLabelText(t('expense.description')), '豚骨拉麵')
    // 3. 儲存
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect(await screen.findByRole('button', { name: /^豚骨拉麵/ })).toBeInTheDocument()
    const created = (await stores.repo.listExpenses('t1')).find((e) => e.description === '豚骨拉麵')!
    // 沒有上一筆的付款方式 → 第一個（現金）→ 匯率先取「日圓×現金」（規格 4.4 的帶入順序）
    expect(created).toMatchObject({ amount: 3800, currency: 'JPY', exchangeRate: 0.215, paidBy: 'a', split: { mode: 'even', participants: ['a', 'b', 'c'] } })
    for (const header of [t('expense.details'), t('split.title'), t('receipt.title')]) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${header}`) })).not.toBeInTheDocument()
    }
  })

  it('keeps the id and the fixed rate when editing, even after changing the payment method', async () => {
    const stores = await tripWithJapan()
    const { user } = await renderApp('/trip/t1/expense/e1/edit', stores)
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    await user.click(screen.getByRole('radio', { name: t('pay.cash') }))
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect(await stores.repo.listExpenses('t1')).toEqual([expect.objectContaining({ id: 'e1', paymentMethodId: 'pay.cash', exchangeRate: 0.2 })])
  })

  it('offers the last category and payment method on the next new expense', async () => {
    const stores = await tripWithJapan()
    const { user } = await renderApp('/trip/t1/expense/new', stores)
    for (const k of ['5', '0', '0']) await user.click(key(k))
    await user.click(screen.getByLabelText(t('expense.description')))
    await user.type(screen.getByLabelText(t('expense.description')), '地鐵')
    const details = () => screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) })
    await user.click(details())
    await user.click(screen.getByRole('radio', { name: t('cat.transport') }))
    await user.click(screen.getByRole('radio', { name: t('pay.mobile') }))
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    await user.click(await screen.findByRole('button', { name: t('expenses.add') }))
    await screen.findByRole('heading', { name: t('expense.new') })
    expect(details()).toHaveTextContent(`${t('cat.transport')}・${t('pay.mobile')}`)
  })

  it('does not change the defaults when editing an old expense', async () => {
    const stores = await tripWithJapan()
    const { user } = await renderApp('/trip/t1/expense/e1/edit', stores)
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    await user.click(screen.getByRole('radio', { name: t('cat.shopping') }))
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect((await stores.repo.getSettings()).lastUsed).toEqual({})
  })
})
