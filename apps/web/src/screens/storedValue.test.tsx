import type { Trip } from '@billing/core'
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { clearSession } from '../data/session'
import { makeExpense, makeTrip } from '../data/testing/fixtures'
import { formatMoney } from '../i18n/format'
import { t } from '../i18n'
import { currentRoute, makeStores, renderApp } from '../test/renderApp'
import { pickCategory } from '../test/pickCategory'

beforeEach(() => clearSession())

const plain = (s: string) => s.replace(/\s+/g, ' ')
const suica = { id: 'suica', name: 'Suica', storedValue: { currency: 'JPY' } }

async function setup(route: string, trip: Partial<Trip> = {}, expenses: Parameters<typeof makeExpense>[0][] = []) {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
  await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD', rates: { default: { JPY: 0.2 }, byMethod: {} }, ...trip }))
  for (const e of expenses) await stores.repo.saveExpense(makeExpense({ tripId: 't1', ...e }))
  const app = await renderApp(route, stores)
  return app
}

async function openMethods(user: Awaited<ReturnType<typeof setup>>['user']) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${t('tripMethods.title')}`) }))
  return within(screen.getByTestId('section-trip-methods-panel'))
}

describe('stored-value cards in trip setup (task#115)', () => {
  it('turns a trip payment method into a stored-value card with a currency', async () => {
    const { user, stores } = await setup('/trip/t1/setup', { paymentMethods: [{ id: 'suica', name: 'Suica' }] })
    const panel = await openMethods(user)
    // task#125：一顆圖示鍵開關；還沒開的時候沒有多出來的那一行
    const toggle = panel.getByRole('button', { name: t('stored.toggle', { name: 'Suica' }) })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(panel.queryByTestId('stored-suica')).not.toBeInTheDocument()
    await user.click(toggle)
    await user.click(within(screen.getByRole('dialog', { name: t('stored.currency') })).getByRole('radio', { name: /^JPY/ }))
    await waitFor(async () => expect((await stores.repo.getTrip('t1'))?.paymentMethods?.find((m) => m.id === 'suica')?.storedValue).toEqual({ currency: 'JPY' }))
    expect(panel.getByRole('button', { name: t('stored.toggle', { name: 'Suica' }) })).toHaveAttribute('aria-pressed', 'true')
    expect(panel.getByTestId('stored-suica')).toHaveTextContent(t('stored.label', { currency: 'JPY' }))
    expect(panel.getByTestId('balance-suica')).toHaveTextContent(plain(t('stored.balance', { amount: formatMoney(0, 'JPY') })))
  })

  it('turns stored-value mode off again with the same button', async () => {
    const { user, stores } = await setup('/trip/t1/setup', { paymentMethods: [suica] })
    const panel = await openMethods(user)
    await user.click(panel.getByRole('button', { name: t('stored.toggle', { name: 'Suica' }) }))
    await waitFor(async () => expect((await stores.repo.getTrip('t1'))?.paymentMethods?.find((m) => m.id === 'suica')?.storedValue).toBeUndefined())
    expect(panel.queryByTestId('stored-suica')).not.toBeInTheDocument()
  })

  // 有紀錄之後改不了：已經蓋好的「從餘額扣」會與設定對不起來
  it('locks the setting once the card has records, and shows its balance', async () => {
    const { user } = await setup('/trip/t1/setup', { paymentMethods: [suica] }, [
      { id: 'top', amount: 5000, currency: 'JPY', paymentMethodId: 'pay.credit', topUpFor: 'suica' },
      { id: 'ride', amount: 200, currency: 'JPY', paymentMethodId: 'suica', fromBalance: true },
    ])
    const panel = await openMethods(user)
    expect(panel.getByRole('button', { name: t('stored.toggle', { name: 'Suica' }) })).toBeDisabled()
    expect(panel.getByTestId('balance-suica')).toHaveTextContent(plain(t('stored.balance', { amount: formatMoney(4800, 'JPY') })))
  })

  it('counts a top-up alone as use, so the setting locks', async () => {
    const { user } = await setup('/trip/t1/setup', { paymentMethods: [suica] }, [
      { id: 'top', amount: 5000, currency: 'JPY', paymentMethodId: 'pay.credit', topUpFor: 'suica' },
    ])
    const panel = await openMethods(user)
    expect(panel.getByRole('button', { name: t('stored.toggle', { name: 'Suica' }) })).toBeDisabled()
  })
})

describe('topping up (task#115)', () => {
  it('opens a top-up form from the card, in the card’s currency, paid another way', async () => {
    const { user, stores } = await setup('/trip/t1/setup', { paymentMethods: [suica] })
    const panel = await openMethods(user)
    await user.click(panel.getByRole('button', { name: t('stored.topUp') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expense/new?topUp=suica'))
    expect(await screen.findByRole('heading', { name: t('topUp.title', { name: 'Suica' }) })).toBeInTheDocument()
    expect(screen.getByTestId('topup-hint')).toHaveTextContent(t('topUp.hint', { name: 'Suica' }))
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    const methods = within(screen.getByRole('radiogroup', { name: t('expense.paymentMethod') }))
    expect(methods.queryByRole('radio', { name: 'Suica' })).not.toBeInTheDocument()
    await user.click(screen.getByLabelText(t('expense.amount')))
    for (const k of ['5', '0', '0', '0']) await user.click(screen.getByRole('button', { name: k }))
    await pickCategory(user)
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(async () => expect((await stores.repo.listExpenses('t1'))[0]).toMatchObject({ topUpFor: 'suica', currency: 'JPY', amount: 5000 }))
    expect((await stores.repo.listExpenses('t1'))[0]).not.toHaveProperty('fromBalance')
  })
})

describe('paying with the card (task#115)', () => {
  it('switches to the card’s currency, shows the balance and stamps the payment', async () => {
    const { user, stores } = await setup('/trip/t1/expense/new', { paymentMethods: [suica] }, [
      { id: 'top', amount: 5000, currency: 'JPY', paymentMethodId: 'pay.credit', topUpFor: 'suica' },
      // 最新一筆是台幣：新表單從台幣開始，選了 Suica 才換成日圓
      { id: 'lunch', amount: 300, currency: 'TWD', exchangeRate: 1, paymentMethodId: 'pay.cash' },
    ])
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    expect(screen.getByRole('button', { name: new RegExp(t('expense.currency')) })).toHaveTextContent('TWD')
    await user.click(within(screen.getByRole('radiogroup', { name: t('expense.paymentMethod') })).getByRole('radio', { name: 'Suica' }))
    expect(screen.getByTestId('stored-note')).toHaveTextContent(plain(t('stored.fromBalance', { name: 'Suica', amount: formatMoney(5000, 'JPY') })))
    await user.click(screen.getByLabelText(t('expense.amount')))
    for (const k of ['2', '0', '0']) await user.click(screen.getByRole('button', { name: k }))
    await user.click(screen.getByLabelText(t('expense.description')))
    await user.type(screen.getByLabelText(t('expense.description')), '地鐵')
    await pickCategory(user)
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(async () => expect((await stores.repo.listExpenses('t1')).find((e) => e.description === '地鐵')).toMatchObject({ fromBalance: true, currency: 'JPY' }))
  })

  // 儲值 5,000 円 = NT$1,000 算進花費；用卡付的 200 円不再算一次
  it('counts the top-up in spending but not the card payment, and tags both in the list', async () => {
    await setup('/trip/t1/expenses', { paymentMethods: [suica] }, [
      { id: 'top', date: '2026-03-15', description: '儲值', amount: 5000, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'pay.credit', topUpFor: 'suica' },
      { id: 'ride', date: '2026-03-15', description: '地鐵', amount: 200, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'suica', fromBalance: true },
    ])
    expect(screen.getByText(plain(t('expenses.spent', { amount: formatMoney(1000, 'TWD') })))).toBeInTheDocument()
    expect(screen.getByRole('region')).toHaveTextContent(plain(t('expenses.dayTotal', { amount: formatMoney(1000, 'TWD') })))
    expect(screen.getByRole('button', { name: /^地鐵/ })).toHaveTextContent(t('stored.paidWith', { name: 'Suica' }))
    expect(screen.getByRole('button', { name: /^儲值/ })).toHaveTextContent(t('stored.topUpTag', { name: 'Suica' }))
  })

  it('explains on the read-only view that a card payment is not counted again', async () => {
    await setup('/trip/t1/expense/ride', { paymentMethods: [suica] }, [
      { id: 'ride', description: '地鐵', amount: 200, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'suica', fromBalance: true },
    ])
    expect(screen.getByTestId('from-balance-note')).toHaveTextContent(t('stored.notCounted', { name: 'Suica' }))
  })
})

describe('paying with the card without a rate (task#119)', () => {
  it('needs no exchange rate, so the payment saves as a finished record', async () => {
    const { user, stores } = await setup('/trip/t1/expense/new', { paymentMethods: [suica], rates: { default: {}, byMethod: {} } })
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    await user.click(within(screen.getByRole('radiogroup', { name: t('expense.paymentMethod') })).getByRole('radio', { name: 'Suica' }))
    await pickCategory(user)
    await user.click(screen.getByLabelText(t('expense.amount')))
    for (const k of ['2', '0', '0']) await user.click(screen.getByRole('button', { name: k }))
    await user.click(screen.getByLabelText(t('expense.description')))
    expect(screen.getByText(t('expense.rateNotNeeded'))).toBeInTheDocument()
    await user.type(screen.getByLabelText(t('expense.description')), '地鐵')
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(async () => expect((await stores.repo.listExpenses('t1'))[0]).toMatchObject({ fromBalance: true, exchangeRate: 0 }))
    expect((await stores.repo.listExpenses('t1'))[0]).not.toHaveProperty('draft')
  })
})
