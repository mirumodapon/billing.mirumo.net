import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeExpense, makeTransfer, makeTrip } from '../../data/testing/fixtures'
import { formatMoney } from '../../i18n/format'
import { t } from '../../i18n'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => {
  clearSession()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())

const plain = (s: string) => s.replace(/\s+/g, ' ')

async function setup(route = '/trip/t1/expenses') {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
  const photo = await stores.blobs.put(new Blob(['x'], { type: 'image/webp' }))
  await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD' }))
  await stores.repo.saveExpense(
    makeExpense({
      id: 'e1',
      tripId: 't1',
      description: '晚餐',
      amount: 3000,
      currency: 'TWD',
      exchangeRate: 1,
      paidBy: 'b',
      split: { mode: 'even', participants: ['a', 'b', 'c'] },
      attachments: [{ id: photo, mimeType: 'image/webp', byteSize: 1, width: 1, height: 1 }],
    }),
  )
  await stores.repo.saveTransfer(makeTransfer({ id: 'x1', tripId: 't1', from: 'c', to: 'a', amount: 500, exchangeRate: 1, note: '還錢' }))
  return renderApp(route, stores)
}

describe('ExpenseViewScreen (task#101)', () => {
  it('opens read-only from the list, with a button to edit', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: /^晚餐/ }))
    expect(currentRoute()).toBe('/trip/t1/expense/e1')
    expect(await screen.findByRole('heading', { name: '晚餐' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('form.save') })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('view.edit') })).toBeInTheDocument()
  })

  it('shows who paid, when, and what each person owes', async () => {
    await setup('/trip/t1/expense/e1')
    expect(screen.getByText(t('expense.paidBy')).parentElement).toHaveTextContent('小美')
    const shares = within(screen.getByRole('region', { name: t('view.shares') }))
    expect(shares.getByText('阿明').parentElement).toHaveTextContent(plain(formatMoney(1000, 'TWD')))
    expect(shares.getByText('大熊').parentElement).toHaveTextContent(plain(formatMoney(1000, 'TWD')))
  })

  it('edits through the form and comes back to the updated view', async () => {
    const { user, stores } = await setup()
    await user.click(screen.getByRole('button', { name: /^晚餐/ }))
    await user.click(await screen.findByRole('button', { name: t('view.edit') }))
    expect(currentRoute()).toBe('/trip/t1/expense/e1/edit')
    const field = await screen.findByLabelText(t('expense.description'))
    await user.clear(field)
    await user.type(field, '宵夜')
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expense/e1'))
    expect(await screen.findByRole('heading', { name: '宵夜' })).toBeInTheDocument()
    expect((await stores.repo.listExpenses('t1'))[0]?.description).toBe('宵夜')
  })

  it('enlarges a receipt and closes it again', async () => {
    const { user } = await setup('/trip/t1/expense/e1')
    await user.click(await screen.findByRole('button', { name: t('receipt.photo', { n: 1 }) }))
    const viewer = screen.getByRole('dialog', { name: t('receipt.photo', { n: 1 }) })
    expect(within(viewer).getByRole('img')).toHaveAttribute('src', 'blob:photo')
    await user.click(within(viewer).getByRole('button', { name: t('photo.close') }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t('receipt.photo', { n: 1 }) }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('enlarges a receipt from the edit form too', async () => {
    const { user } = await setup('/trip/t1/expense/e1/edit')
    // 標題與縮圖按鈕都以「收據」開頭；jsdom 不支援 inert，收起的面板也找得到，所以挑標題
    const header = screen.getAllByRole('button', { name: new RegExp(`^${t('receipt.title')}`) }).find((b) => b.hasAttribute('aria-expanded'))!
    await user.click(header)
    await user.click(await screen.findByRole('button', { name: t('receipt.photo', { n: 1 }) }))
    expect(screen.getByRole('dialog', { name: t('receipt.photo', { n: 1 }) })).toBeInTheDocument()
  })

  it('returns to the list for an expense that is not there', async () => {
    await setup('/trip/t1/expense/nope')
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
  })
})

describe('TransferViewScreen (task#101)', () => {
  it('opens read-only from the settle tab, and edits through the form', async () => {
    const { user } = await setup('/trip/t1/settle')
    await user.click(screen.getByRole('button', { name: /大熊 → 阿明/ }))
    expect(currentRoute()).toBe('/trip/t1/transfer/x1')
    expect(await screen.findByRole('heading', { name: '大熊 → 阿明' })).toBeInTheDocument()
    expect(screen.getByText('還錢')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('form.save') })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t('view.edit') }))
    expect(currentRoute()).toBe('/trip/t1/transfer/x1/edit')
    expect(await screen.findByRole('heading', { name: t('transfer.edit') })).toBeInTheDocument()
  })
})

describe('view layout (task#107)', () => {
  it('leads with what, how much and when', async () => {
    await setup('/trip/t1/expense/e1')
    const hero = within(screen.getByRole('region', { name: t('view.summary') }))
    expect(hero.getByText(t('cat.food'))).toBeInTheDocument()
    expect(hero.getByText(plain(formatMoney(3000, 'TWD')))).toBeInTheDocument()
    expect(hero.getByText(/3\/15/)).toBeInTheDocument()
  })

  // 占比條讓人不用心算就看出誰分得多
  it('draws each share as a part of the whole', async () => {
    const stores = await makeStores()
    await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
    await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD' }))
    await stores.repo.saveExpense(makeExpense({ id: 'e1', tripId: 't1', amount: 1000, currency: 'TWD', exchangeRate: 1, split: { mode: 'exact', amounts: { a: 750, b: 250 } } }))
    await renderApp('/trip/t1/expense/e1', stores)
    const shares = screen.getByRole('region', { name: t('view.shares') })
    const widths = [...shares.querySelectorAll<HTMLElement>('.app-share__bar > span')].map((s) => s.style.width)
    expect(widths).toEqual(['75%', '25%'])
  })

  it('shows who gave money to whom on a transfer', async () => {
    await setup('/trip/t1/transfer/x1')
    const hero = within(screen.getByRole('region', { name: t('view.summary') }))
    expect(hero.getAllByText(/^(大熊|阿明)$/).map((n) => n.textContent)).toEqual(['大熊', '阿明'])
    expect(hero.getByText(plain(formatMoney(500, 'TWD')))).toBeInTheDocument()
  })
})
