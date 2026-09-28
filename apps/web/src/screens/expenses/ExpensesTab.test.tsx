import { convertToBaseMinor } from '@billing/core'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeExpense, makeTransfer, makeTrip } from '../../data/testing/fixtures'
import { formatDate, formatMoney, formatWeekday } from '../../i18n/format'
import { t } from '../../i18n'
import { createUiStore } from '../../stores/uiStore'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

const plain = (s: string) => s.replace(/\s+/g, ' ')

async function setup(options: { budget?: number } = {}) {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
  await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD', budget: { total: options.budget, scope: 'group' } }))
  await stores.repo.saveExpense(makeExpense({ id: 'ramen', tripId: 't1', date: '2026-03-15', description: '一蘭拉麵', amount: 3000, currency: 'JPY', exchangeRate: 0.21 }))
  await stores.repo.saveExpense(
    makeExpense({
      id: 'ticket',
      tripId: 't1',
      date: '2026-03-15',
      description: '淺草寺門票',
      amount: 500,
      currency: 'TWD',
      exchangeRate: 1,
      paidBy: 'b',
      split: { mode: 'exact', amounts: { a: 250, b: 250 } },
      attachments: [{ id: 'p', mimeType: 'image/webp', byteSize: 1, width: 1, height: 1 }],
    }),
  )
  await stores.repo.saveExpense(makeExpense({ id: 'taxi', tripId: 't1', date: '2026-03-16', description: '', amount: 200, currency: 'TWD', exchangeRate: 1 }))
  await stores.repo.saveTransfer(makeTransfer({ tripId: 't1', note: '還錢' }))
  return renderApp('/trip/t1/expenses', stores)
}

const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })

describe('ExpensesTab', () => {
  it('groups expenses by day, newest day first, with a total for each day', async () => {
    await setup()
    const days = screen.getAllByRole('region')
    expect(days.map((d) => d.getAttribute('aria-label'))).toEqual([
      `${formatDate('2026-03-16')} ${formatWeekday('2026-03-16')}`,
      `${formatDate('2026-03-15')} ${formatWeekday('2026-03-15')}`,
    ])
    const dayTotal = formatMoney(convertToBaseMinor(3000, 0.21, 'TWD') + 500, 'TWD')
    expect(days[1]).toHaveTextContent(plain(t('expenses.dayTotal', { amount: dayTotal })))
  })

  it('shows the original and home amounts for a foreign expense, and one amount otherwise', async () => {
    await setup()
    expect(row('一蘭拉麵')).toHaveTextContent(plain(formatMoney(3000, 'JPY')))
    expect(row('一蘭拉麵')).toHaveTextContent(plain(formatMoney(630, 'TWD')))
    const once = plain(formatMoney(500, 'TWD'))
    expect(plain(row('淺草寺門票').textContent ?? '').split(once)).toHaveLength(2)
  })

  it('says who paid and how it was split, and marks receipts', async () => {
    await setup()
    expect(row('淺草寺門票')).toHaveTextContent(t('expenses.paidSplit', { payer: '小美', split: t('split.summaryExact') }))
    expect(within(row('淺草寺門票')).getByRole('img', { name: t('expenses.hasReceipt') })).toBeInTheDocument()
    expect(within(row('一蘭拉麵')).queryByRole('img', { name: t('expenses.hasReceipt') })).not.toBeInTheDocument()
  })

  it('names an expense without a description', async () => {
    await setup()
    expect(row(t('expense.untitled'))).toBeInTheDocument()
  })

  // 規格 2.5：轉帳不是消費，不進支出列表
  it('leaves transfers out', async () => {
    await setup()
    expect(screen.queryByText('還錢')).not.toBeInTheDocument()
  })

  it('shows spending against the budget only when there is one', async () => {
    await setup({ budget: 10000 })
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText(plain(t('expenses.summary', { spent: formatMoney(1330, 'TWD'), budget: formatMoney(10000, 'TWD') })))).toBeInTheDocument()
  })

  it('shows plain spending without a budget', async () => {
    await setup()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText(plain(t('expenses.spent', { amount: formatMoney(1330, 'TWD') })))).toBeInTheDocument()
  })

  it('deletes an expense and brings it back with undo', async () => {
    const { user } = await setup()
    const ramen = row('一蘭拉麵').closest('.bi-swipe') as HTMLElement
    await user.click(within(ramen).getByRole('button', { name: t('common.delete') }))
    expect(screen.queryByRole('button', { name: /^一蘭拉麵/ })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: t('common.undo') }))
    expect(await screen.findByRole('button', { name: /^一蘭拉麵/ })).toBeInTheDocument()
  })

  it('opens an expense for editing', async () => {
    const { user } = await setup()
    await user.click(row('一蘭拉麵'))
    expect(currentRoute()).toBe('/trip/t1/expense/ramen')
  })

  it('invites the first expense when there are none', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1' }))
    await renderApp('/trip/t1/expenses', stores)
    expect(screen.getByText(t('expenses.empty'))).toBeInTheDocument()
  })
})

describe('adding from the list', () => {
  it('opens the new-expense form from the button and returns to the list', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: t('expenses.add') }))
    expect(currentRoute()).toBe('/trip/t1/expense/new')
    await waitFor(() => expect(screen.getByTestId('page')).toHaveAttribute('data-direction', 'up'))
    await user.click(screen.getByRole('button', { name: t('form.close') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    await waitFor(() => expect(screen.getByTestId('page')).toHaveAttribute('data-direction', 'down'))
  })

  // 關閉是「退回上一頁」而不是「換成列表」：再按一次返回鍵要回到旅程列表，不是又一次支出列表
  it('closes by going back, not by replacing the page', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京' }))
    const { user } = await renderApp('/', stores)
    await user.click(screen.getByRole('button', { name: /^東京/ }))
    await user.click(await screen.findByRole('button', { name: t('expenses.add') }))
    await user.click(await screen.findByRole('button', { name: t('form.close') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    history.back()
    await waitFor(() => expect(currentRoute()).toBe('/'))
  })
})

describe('home-currency toggle (task#99)', () => {
  it('shows both amounts by default, and only the original once switched off', async () => {
    const { user, stores } = await setup()
    const toggle = screen.getByRole('button', { name: t('expenses.showBase') })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(row('一蘭拉麵')).toHaveTextContent(plain(formatMoney(630, 'TWD')))
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(row('一蘭拉麵')).toHaveTextContent(plain(formatMoney(3000, 'JPY')))
    expect(row('一蘭拉麵')).not.toHaveTextContent(plain(formatMoney(630, 'TWD')))
    // 本位幣的支出本來就只有一個金額，照常顯示
    expect(row('淺草寺門票')).toHaveTextContent(plain(formatMoney(500, 'TWD')))
    await waitFor(async () => expect((await stores.repo.getSettings()).showBaseAmounts).toBe(false))
  })

  // 合計與摘要是全團的帳，一律用本位幣
  it('keeps day totals and the summary in the home currency', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: t('expenses.showBase') }))
    const dayTotal = formatMoney(convertToBaseMinor(3000, 0.21, 'TWD') + 500, 'TWD')
    expect(screen.getAllByRole('region')[1]).toHaveTextContent(plain(t('expenses.dayTotal', { amount: dayTotal })))
    expect(screen.getByText(plain(t('expenses.spent', { amount: formatMoney(1330, 'TWD') })))).toBeInTheDocument()
  })
})

describe('expense filter (task#106)', () => {
  async function openFilter(user: Awaited<ReturnType<typeof setup>>['user']) {
    await user.click(screen.getByRole('button', { name: t('expenses.filter') }))
    return within(screen.getByRole('dialog', { name: t('expenses.filter') }))
  }

  it('narrows the list, the day totals and a filtered total, but not the trip summary', async () => {
    const { user } = await setup()
    const sheet = await openFilter(user)
    await user.click(within(sheet.getByRole('group', { name: t('expense.paidBy') })).getByRole('button', { name: '小美' }))
    await user.click(sheet.getByRole('button', { name: t('filter.done') }))
    expect(screen.getByRole('button', { name: /^淺草寺門票/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^一蘭拉麵/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(screen.getByRole('region')).toHaveTextContent(plain(t('expenses.dayTotal', { amount: formatMoney(500, 'TWD') })))
    expect(screen.getByRole('status')).toHaveTextContent(plain(t('expenses.filtered', { count: 1, amount: formatMoney(500, 'TWD') })))
    // 摘要與預算是整趟旅程的帳，不跟著篩選
    expect(screen.getByText(plain(t('expenses.spent', { amount: formatMoney(1330, 'TWD') })))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('expenses.filter') })).toHaveAttribute('data-active')
  })

  it('keeps the filter after opening an expense and coming back, until it is cleared', async () => {
    const { user } = await setup()
    const sheet = await openFilter(user)
    await user.click(within(sheet.getByRole('group', { name: t('expense.paidBy') })).getByRole('button', { name: '小美' }))
    await user.click(sheet.getByRole('button', { name: t('filter.done') }))
    await user.click(screen.getByRole('button', { name: /^淺草寺門票/ }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expense/ticket'))
    await user.click(screen.getByRole('button', { name: t('form.close') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect(await screen.findByRole('button', { name: /^淺草寺門票/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^一蘭拉麵/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t('expenses.clearFilter') }))
    expect(screen.getByRole('button', { name: /^一蘭拉麵/ })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    const { user } = await setup()
    const sheet = await openFilter(user)
    await user.click(sheet.getByRole('button', { name: t('filter.draftsOnly') }))
    expect(screen.getByText(t('expenses.noMatch'))).toBeInTheDocument()
  })

  // 一整排這趟旅程從沒用過的類別只是雜訊
  it('offers only the categories and payment methods this trip uses', async () => {
    const { user } = await setup()
    const sheet = await openFilter(user)
    const categories = within(sheet.getByRole('group', { name: t('expense.category') }))
    expect(categories.getAllByRole('button').map((b) => b.textContent)).toEqual([t('cat.food')])
    const methods = within(sheet.getByRole('group', { name: t('expense.paymentMethod') }))
    expect(methods.getAllByRole('button').map((b) => b.textContent)).toEqual([t('pay.cash')])
  })
})

describe('expense filter across a restart (task#91, spec 7.9)', () => {
  it('comes back after the app is reopened', async () => {
    const { user, stores } = await setup()
    await user.click(screen.getByRole('button', { name: t('expenses.filter') }))
    const sheet = within(screen.getByRole('dialog', { name: t('expenses.filter') }))
    await user.click(within(sheet.getByRole('group', { name: t('expense.paidBy') })).getByRole('button', { name: '小美' }))
    cleanup()
    // 重開 app：畫面層的 store 是新的，只剩 session 記得篩選
    await renderApp('/trip/t1/expenses', { ...stores, ui: createUiStore() })
    expect(screen.getByRole('button', { name: /^淺草寺門票/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^一蘭拉麵/ })).not.toBeInTheDocument()
  })
})
