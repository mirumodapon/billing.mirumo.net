import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeExpense, makeTransfer, makeTrip } from '../../data/testing/fixtures'
import { formatMoney } from '../../i18n/format'
import { t } from '../../i18n'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())
afterEach(() => vi.unstubAllGlobals())

const plain = (s: string) => s.replace(/\s+/g, ' ')

/** Task 4 的手算情境：阿明 +1,500、小美 −400、大熊 −1,100 */
async function setup() {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
  await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京五日', baseCurrency: 'TWD' }))
  await stores.repo.saveExpense(makeExpense({ id: 'e1', tripId: 't1', paidBy: 'a', amount: 3000, currency: 'TWD', exchangeRate: 1, split: { mode: 'even', participants: ['a', 'b', 'c'] } }))
  await stores.repo.saveExpense(makeExpense({ id: 'e2', tripId: 't1', paidBy: 'b', amount: 1200, currency: 'TWD', exchangeRate: 1, split: { mode: 'even', participants: ['b', 'c'] } }))
  await stores.repo.saveTransfer(makeTransfer({ id: 'x1', tripId: 't1', from: 'c', to: 'a', amount: 500, currency: 'TWD', exchangeRate: 1, kind: 'loan', note: '現金不夠' }))
  return renderApp('/trip/t1/settle', stores)
}

const balance = (id: string) => screen.getByTestId(`balance-${id}`)
const pending = () => screen.queryAllByTestId('pending')

describe('SettleTab', () => {
  it('answers who owes whom, what happened and what is left, in that order', async () => {
    await setup()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([t('settle.balances'), t('settle.transfers'), t('settle.pending')])
  })

  it('shows each balance with its sign and a status in words', async () => {
    await setup()
    expect(balance('a')).toHaveTextContent(plain(`阿明+${formatMoney(1500, 'TWD')}${t('settle.receive')}`))
    expect(balance('b')).toHaveTextContent(plain(`小美${formatMoney(-400, 'TWD')}${t('settle.pay')}`))
    expect(balance('c')).toHaveTextContent(plain(`大熊${formatMoney(-1100, 'TWD')}${t('settle.pay')}`))
  })

  it('lists transfers with who, how much, what kind and the note', async () => {
    await setup()
    const row = screen.getByRole('button', { name: /大熊 → 阿明/ })
    expect(row).toHaveTextContent(t('transfer.loan'))
    expect(row).toHaveTextContent('現金不夠')
    expect(row).toHaveTextContent(plain(formatMoney(500, 'TWD')))
  })

  it('suggests the fewest transfers to settle up', async () => {
    await setup()
    expect(pending().map((p) => plain(p.textContent ?? ''))).toEqual([
      plain(`大熊 → 阿明 ${formatMoney(1100, 'TWD')}${t('settle.markSettled')}`),
      plain(`小美 → 阿明 ${formatMoney(400, 'TWD')}${t('settle.markSettled')}`),
    ])
  })

  // 規格 4.6：「已結清」開出預填好的表單，存成一筆真的轉帳；存完該筆建議消失
  it('settles up through real transfers until everyone is square', async () => {
    const { user, stores } = await setup()
    await user.click(within(pending()[0]!).getByRole('button', { name: t('settle.markSettled') }))
    expect(currentRoute()).toBe('/trip/t1/transfer/new?from=c&to=a&amount=1100&kind=settlement')
    await user.click(await screen.findByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/settle'))
    await waitFor(() => expect(pending()).toHaveLength(1))
    await user.click(within(pending()[0]!).getByRole('button', { name: t('settle.markSettled') }))
    await user.click(await screen.findByRole('button', { name: t('form.save') }))
    await waitFor(() => expect(screen.getByText(t('settle.allSettled'))).toBeInTheDocument())
    for (const id of ['a', 'b', 'c']) expect(balance(id)).toHaveTextContent(t('settle.settled'))
    expect((await stores.repo.listTransfers('t1')).filter((x) => x.kind === 'settlement')).toHaveLength(2)
  })

  it('opens a transfer for editing and deletes one with undo', async () => {
    const { user } = await setup()
    const swipe = screen.getByRole('button', { name: /大熊 → 阿明/ }).closest('.bi-swipe') as HTMLElement
    await user.click(within(swipe).getByRole('button', { name: t('common.delete') }))
    await waitFor(() => expect(balance('c')).toHaveTextContent(plain(formatMoney(-1600, 'TWD'))))
    await user.click(await screen.findByRole('button', { name: t('common.undo') }))
    await waitFor(() => expect(balance('c')).toHaveTextContent(plain(formatMoney(-1100, 'TWD'))))
    await user.click(screen.getByRole('button', { name: /大熊 → 阿明/ }))
    expect(currentRoute()).toBe('/trip/t1/transfer/x1')
  })

  it('opens a new transfer from the section header', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: t('transfer.new') }))
    expect(currentRoute()).toBe('/trip/t1/transfer/new')
  })

  it('shares the summary through the share sheet', async () => {
    const share = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, share })
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: t('settle.share') }))
    expect(share).toHaveBeenCalledWith({ title: t('settle.shareTitle', { trip: '東京五日' }), text: expect.stringContaining(t('settle.pending')) })
  })

  // jsdom 沒有 Web Share；剪貼簿由 user-event 提供替身，內容讀得回來
  it('copies the summary when there is no share sheet, and says so', async () => {
    const { user } = await setup()
    expect('share' in navigator).toBe(false)
    await user.click(screen.getByRole('button', { name: t('settle.share') }))
    await waitFor(async () => expect(await navigator.clipboard.readText()).toContain('東京五日'))
    expect(await screen.findByText(t('settle.copied'))).toBeInTheDocument()
  })
})
