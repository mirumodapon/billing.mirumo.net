import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeExpense, makeTransfer, makeTrip } from '../../data/testing/fixtures'
import { formatMoney } from '../../i18n/format'
import { t } from '../../i18n'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

const plain = (s: string) => s.replace(/\s+/g, ' ')

/** 一筆正式的 3,000（阿明付、三人均分）加上一筆 999 的草稿，同一天 */
async function setup(route: string) {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
  await stores.repo.saveTrip(
    makeTrip({ id: 't1', baseCurrency: 'TWD', startDate: '2026-03-15', endDate: '2026-03-16', rates: { default: { JPY: 0.21 }, byMethod: {} } }),
  )
  await stores.repo.saveExpense(makeExpense({ id: 'real', tripId: 't1', date: '2026-03-15', description: '晚餐', amount: 3000, currency: 'TWD', exchangeRate: 1 }))
  await stores.repo.saveExpense(
    makeExpense({ id: 'draft', tripId: 't1', date: '2026-03-15', description: '還沒分好', amount: 999, currency: 'TWD', exchangeRate: 1, draft: true }),
  )
  return renderApp(route, stores)
}

const draftToggle = () => screen.getByRole('button', { name: t('record.draft') })
const key = (name: string) => screen.getByRole('button', { name })

describe('drafts in the expense form (task#96)', () => {
  it('saves an unfinished expense as a draft instead of refusing', async () => {
    const { user, stores } = await setup('/trip/t1/expense/new')
    expect(draftToggle()).toHaveAttribute('aria-pressed', 'true')
    expect(draftToggle()).toBeDisabled()
    expect(screen.getByTestId('draft-hint')).toHaveTextContent(t('form.draftForced'))
    await user.click(screen.getByLabelText(t('expense.description')))
    await user.type(screen.getByLabelText(t('expense.description')), '計程車')
    await user.click(key(t('form.saveDraft')))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect((await stores.repo.listExpenses('t1')).find((e) => e.description === '計程車')).toMatchObject({ draft: true, amount: 0 })
  })

  it('lets a finished expense be saved as a draft on purpose', async () => {
    const { user, stores } = await setup('/trip/t1/expense/new')
    for (const k of ['1', '2', '0']) await user.click(key(k))
    await user.click(screen.getByLabelText(t('expense.description')))
    await user.type(screen.getByLabelText(t('expense.description')), '咖啡')
    expect(draftToggle()).toHaveAttribute('aria-pressed', 'false')
    expect(key(t('form.save'))).toBeEnabled()
    await user.click(draftToggle())
    expect(draftToggle()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('draft-hint')).toHaveTextContent(t('form.draftHint'))
    await user.click(key(t('form.saveDraft')))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    expect((await stores.repo.listExpenses('t1')).find((e) => e.description === '咖啡')?.draft).toBe(true)
  })

  it('turns a draft into a real expense once the toggle is switched off', async () => {
    const { user, stores } = await setup('/trip/t1/expense/draft/edit')
    expect(draftToggle()).toHaveAttribute('aria-pressed', 'true')
    expect(draftToggle()).toBeEnabled()
    await user.click(draftToggle())
    await user.click(key(t('form.save')))
    await waitFor(() => expect(currentRoute()).not.toContain('/edit'))
    expect((await stores.repo.listExpenses('t1')).find((e) => e.id === 'draft')).not.toHaveProperty('draft')
  })
})

describe('drafts in the lists (task#96)', () => {
  it('marks a draft expense and leaves it out of the day total and the spending', async () => {
    await setup('/trip/t1/expenses')
    const draftRow = screen.getByRole('button', { name: /^還沒分好/ })
    expect(within(draftRow).getByText(t('record.draft'))).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /^晚餐/ })).queryByText(t('record.draft'))).not.toBeInTheDocument()
    const total = formatMoney(3000, 'TWD')
    expect(screen.getByRole('region')).toHaveTextContent(plain(t('expenses.dayTotal', { amount: total })))
    expect(document.body).toHaveTextContent(plain(t('expenses.spent', { amount: total })))
  })

  it('marks a draft transfer and keeps it out of the balances', async () => {
    const stores = await makeStores()
    await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
    await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD' }))
    await stores.repo.saveExpense(makeExpense({ tripId: 't1', paidBy: 'a', amount: 3000, currency: 'TWD', exchangeRate: 1, split: { mode: 'even', participants: ['a', 'b', 'c'] } }))
    await stores.repo.saveTransfer(makeTransfer({ tripId: 't1', from: 'b', to: 'a', amount: 1000, currency: 'TWD', exchangeRate: 1, draft: true }))
    await renderApp('/trip/t1/settle', stores)
    expect(screen.getByTestId('balance-a')).toHaveTextContent(formatMoney(2000, 'TWD'))
    expect(screen.getByRole('button', { name: /小美 → 阿明/ })).toHaveTextContent(t('record.draft'))
  })
})

describe('drafts in the read-only view (task#96)', () => {
  // 草稿可能還沒匯率、也還沒選人：檢視頁照樣打得開
  it('says the record is a draft, and copes with a missing rate and nobody to split with', async () => {
    const stores = await makeStores()
    await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
    await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD' }))
    await stores.repo.saveExpense(
      makeExpense({ id: 'd', tripId: 't1', description: '未完成', amount: 500, currency: 'JPY', exchangeRate: 0, draft: true, split: { mode: 'even', participants: [] } }),
    )
    await renderApp('/trip/t1/expense/d', stores)
    expect(screen.getByRole('note')).toHaveTextContent(t('form.draftHint'))
    expect(screen.queryByText(/^≈/)).not.toBeInTheDocument()
  })
})
