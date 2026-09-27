import { convertToBaseMinor } from '@billing/core'
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeTrip } from '../../data/testing/fixtures'
import { formatMoney } from '../../i18n/format'
import { t } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

async function openNew(lastCurrency = 'JPY') {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), lastUsed: { currency: lastCurrency, paymentMethodId: 'pay.credit' } })
  await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD', rates: { default: { JPY: 0.21 }, byMethod: {} } }))
  return renderApp('/trip/t1/expense/new', stores)
}

const key = (name: string) => screen.getByRole('button', { name })
const amountField = () => screen.getByLabelText(t('expense.amount'))
const plain = (s: string) => s.replace(/\s+/g, ' ')

describe('AmountSection', () => {
  // 規格 4.4：金額常駐展開，開頁自動聚焦
  it('opens with the amount focused and the keypad up', async () => {
    await openNew()
    expect(amountField()).toHaveFocus()
    expect(key(t('keypad.done'))).toBeInTheDocument()
    // 不喚起系統鍵盤（規格 5.3）
    expect(amountField()).toHaveAttribute('inputmode', 'none')
    expect(amountField()).toHaveAttribute('readonly')
  })

  it('works out an expression and shows what it is worth at home', async () => {
    const { user } = await openNew()
    for (const k of ['1', '2', '0', '0', '+', '8', '0', '0', '×', '2']) await user.click(key(k))
    await user.click(key(t('keypad.done')))
    expect(amountField()).toHaveValue('2800')
    expect(screen.getByText(/^≈/)).toHaveTextContent(plain(t('expense.converted', { amount: formatMoney(convertToBaseMinor(2800, 0.21, 'TWD'), 'TWD') })))
  })

  // 典型三個動作：輸入金額 → 輸入說明 → 儲存。沒按「完成」直接去打說明，金額不能不見
  it('keeps the amount when the user moves on without pressing done', async () => {
    const { user } = await openNew()
    for (const k of ['3', '8', '0', '0']) await user.click(key(k))
    await user.click(screen.getByLabelText(t('expense.description')))
    expect(screen.queryByRole('button', { name: t('keypad.done') })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(t('expense.description')), '一蘭拉麵')
    expect(screen.getByRole('button', { name: t('expense.save') })).toBeEnabled()
  })

  it('disables the decimal point for currencies without minor units', async () => {
    const { user } = await openNew()
    expect(key('.')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.pickCurrency', { currency: '' }).trim()}`) }))
    await user.click(within(screen.getByRole('dialog', { name: t('expense.currency') })).getByRole('radio', { name: /^USD/ }))
    await user.click(amountField())
    expect(key('.')).toBeEnabled()
  })

  it('lets the rate be set by hand', async () => {
    const { user } = await openNew()
    for (const k of ['1', '0', '0', '0']) await user.click(key(k))
    await user.click(key(t('keypad.done')))
    await user.click(screen.getByRole('button', { name: t('expense.editRate') }))
    await user.click(key(t('keypad.clear')))
    for (const k of ['0', '.', '2']) await user.click(key(k))
    await user.click(key(t('keypad.done')))
    expect(screen.getByText(/^≈/)).toHaveTextContent(plain(t('expense.converted', { amount: formatMoney(200, 'TWD') })))
  })

  it('asks for a rate when the trip has none for the currency, and blocks saving', async () => {
    const { user } = await openNew('KRW')
    for (const k of ['5', '0', '0', '0']) await user.click(key(k))
    await user.click(screen.getByLabelText(t('expense.description')))
    await user.type(screen.getByLabelText(t('expense.description')), '炸雞')
    expect(screen.getByText(t('expense.noRate', { currency: 'KRW' }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('expense.save') })).toBeDisabled()
  })

  it('shows no conversion or rate for the home currency', async () => {
    await openNew('TWD')
    expect(screen.queryByRole('button', { name: t('expense.editRate') })).not.toBeInTheDocument()
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument()
  })
})
