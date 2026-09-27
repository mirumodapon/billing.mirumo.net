import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../../data/session'
import { makeTransfer, makeTrip } from '../../data/testing/fixtures'
import { t } from '../../i18n'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

async function setup(route: string) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD', rates: { default: { JPY: 0.21 }, byMethod: {} } }))
  await stores.repo.saveTransfer(makeTransfer({ id: 'x1', tripId: 't1', from: 'b', to: 'a', amount: 300, currency: 'JPY', exchangeRate: 0.2, note: '車票' }))
  return renderApp(route, stores)
}

const key = (name: string) => screen.getByRole('button', { name })
const group = (name: string) => within(screen.getByRole('radiogroup', { name }))

describe('TransferFormScreen', () => {
  it('records a loan from me to someone else', async () => {
    const { user, stores } = await setup('/trip/t1/transfer/new')
    expect(group(t('transfer.from')).getByRole('radio', { name: '阿明' })).toBeChecked()
    expect(group(t('transfer.to')).getByRole('radio', { name: '小美' })).toBeChecked()
    for (const k of ['5', '0', '0']) await user.click(key(k))
    await user.click(key(t('keypad.done')))
    await user.type(screen.getByLabelText(t('transfer.note')), '現金不夠')
    await user.click(key(t('form.save')))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/settle'))
    const saved = (await stores.repo.listTransfers('t1')).find((x) => x.note === '現金不夠')
    expect(saved).toMatchObject({ from: 'a', to: 'b', amount: 500, currency: 'TWD', exchangeRate: 1, kind: 'loan' })
  })

  // 規格 4.6：「已結清」開出的表單金額與雙方預先填好、kind 帶 settlement
  it('opens a settlement already filled in from the address', async () => {
    await setup('/trip/t1/transfer/new?from=c&to=a&amount=1100&kind=settlement')
    expect(screen.getByLabelText(t('expense.amount'))).toHaveValue('1100')
    expect(group(t('transfer.from')).getByRole('radio', { name: '大熊' })).toBeChecked()
    expect(group(t('transfer.to')).getByRole('radio', { name: '阿明' })).toBeChecked()
    expect(group(t('transfer.kind')).getByRole('radio', { name: t('transfer.settlement') })).toBeChecked()
    // 預填了金額就不必一進來就跳鍵盤
    expect(screen.queryByRole('button', { name: t('keypad.done') })).not.toBeInTheDocument()
    expect(key(t('form.save'))).toBeEnabled()
  })

  // 還錢時湊整（欠 1,100 給 1,200）是常有的事
  it('lets the prefilled amount be changed', async () => {
    const { user, stores } = await setup('/trip/t1/transfer/new?from=c&to=a&amount=1100&kind=settlement')
    await user.click(screen.getByLabelText(t('expense.amount')))
    await user.click(key(t('keypad.clear')))
    for (const k of ['1', '2', '0', '0']) await user.click(key(k))
    await user.click(key(t('keypad.done')))
    await user.click(key(t('form.save')))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/settle'))
    expect((await stores.repo.listTransfers('t1')).find((x) => x.from === 'c')?.amount).toBe(1200)
  })

  it('will not save a transfer to oneself, and says why', async () => {
    const { user } = await setup('/trip/t1/transfer/new?amount=100')
    await user.click(group(t('transfer.to')).getByRole('radio', { name: '阿明' }))
    expect(screen.getByRole('alert')).toHaveTextContent(t('transfer.sameMember'))
    expect(key(t('form.save'))).toBeDisabled()
  })

  it('keeps the id and the fixed rate when editing', async () => {
    const { user, stores } = await setup('/trip/t1/transfer/x1/edit')
    expect(screen.getByRole('heading', { name: t('transfer.edit') })).toBeInTheDocument()
    expect(screen.getByLabelText(t('transfer.note'))).toHaveValue('車票')
    await user.type(screen.getByLabelText(t('transfer.note')), '！')
    await user.click(key(t('form.save')))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/settle'))
    expect(await stores.repo.listTransfers('t1')).toEqual([expect.objectContaining({ id: 'x1', exchangeRate: 0.2, note: '車票！' })])
  })

  it('returns to the settle tab for a transfer that is not there', async () => {
    await setup('/trip/t1/transfer/nope')
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/settle'))
  })

  // 規格 7.9：轉帳表單同樣有草稿；預填的表單以完整網址為 key
  it('restores a half-filled settlement from its draft', async () => {
    const route = '/trip/t1/transfer/new?from=c&to=a&amount=1100&kind=settlement'
    const { user, stores } = await setup(route)
    await user.type(screen.getByLabelText(t('transfer.note')), '先還一半')
    await waitFor(async () => expect(await stores.drafts.load(route)).toBeDefined())
    cleanup()
    await act(async () => {})
    await renderApp(route, stores)
    expect(screen.getByLabelText(t('transfer.note'))).toHaveValue('先還一半')
    expect(screen.getByTestId('draft-banner')).toBeInTheDocument()
  })

  // 規格 2.5：轉帳不是消費
  it('keeps transfers out of the expense list', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1' }))
    await stores.repo.saveTransfer(makeTransfer({ id: 'x1', tripId: 't1', note: '還錢' }))
    await renderApp('/trip/t1/expenses', stores)
    expect(screen.getByText(t('expenses.empty'))).toBeInTheDocument()
    expect(screen.queryByText('還錢')).not.toBeInTheDocument()
  })
})
