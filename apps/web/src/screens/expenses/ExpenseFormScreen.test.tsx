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
    expect(screen.getByRole('button', { name: t('expense.save') })).toBeDisabled()
  })

  it('opens an existing expense for editing', async () => {
    await setup('/trip/t1/expense/e1')
    expect(screen.getByRole('heading', { name: t('expense.edit') })).toBeInTheDocument()
    expect(screen.getByLabelText(t('expense.description'))).toHaveValue('一蘭拉麵')
    expect(screen.getByRole('button', { name: t('expense.save') })).toBeEnabled()
  })

  it('saves an edit and leaves the form', async () => {
    const { user, stores } = await setup('/trip/t1/expense/e1')
    const field = screen.getByLabelText(t('expense.description'))
    await user.clear(field)
    await user.type(field, '豚骨拉麵')
    await user.click(screen.getByRole('button', { name: t('expense.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect((await stores.repo.listExpenses('t1')).map((e) => [e.id, e.description])).toEqual([['e1', '豚骨拉麵']])
  })

  // 直接由 session 還原進表單時前面沒有頁面：關閉要去支出列表，不是退出 app
  it('closes to the expenses tab when there is no page to go back to', async () => {
    const { user } = await setup('/trip/t1/expense/new')
    await user.click(screen.getByRole('button', { name: t('expense.close') }))
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
