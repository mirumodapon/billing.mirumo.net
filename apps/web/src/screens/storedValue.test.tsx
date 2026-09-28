import { netBalances, type Trip } from '@billing/core'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { clearSession } from '../data/session'
import { makeExpense, makeTrip } from '../data/testing/fixtures'
import { formatMoney } from '../i18n/format'
import { t, tPlural } from '../i18n'
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
    expect(panel.getByTestId('balance-suica')).toHaveTextContent(plain(t('stored.balance', { amount: formatMoney(480000, 'JPY') })))
  })

  it('counts a top-up alone as use, so the setting locks', async () => {
    const { user } = await setup('/trip/t1/setup', { paymentMethods: [suica] }, [
      { id: 'top', amount: 5000, currency: 'JPY', paymentMethodId: 'pay.credit', topUpFor: 'suica' },
    ])
    const panel = await openMethods(user)
    expect(panel.getByRole('button', { name: t('stored.toggle', { name: 'Suica' }) })).toBeDisabled()
  })
})

// task#139：儲值不是支出，使用筆數分開寫
describe('usage counts with top-ups (task#139)', () => {
  it('counts top-ups apart from expenses, on the card and on what paid for the top-up', async () => {
    const { user } = await setup('/trip/t1/setup', { paymentMethods: [suica] }, [
      { id: 'top', amount: 5000, currency: 'JPY', paymentMethodId: 'pay.credit', topUpFor: 'suica' },
      { id: 'ride', amount: 200, currency: 'JPY', paymentMethodId: 'suica', fromBalance: true },
    ])
    const panel = await openMethods(user)
    expect(panel.getByText(t('tripMethods.usedByBoth', { expenses: 1, topUps: 1 }))).toBeInTheDocument()
    expect(panel.getByText(tPlural('tripMethods.usedByTopUps', { count: 1 }))).toBeInTheDocument()
    expect(panel.queryByText(tPlural('settings.usedBy', { count: 2 }))).not.toBeInTheDocument()
  })
})

// task#142：儲值固定歸在「儲值」：不選類別，列表上是錢包不是問號，也不出現在類別篩選
describe('the top-up category (task#142)', () => {
  it('shows a wallet in the list instead of a question mark', async () => {
    await setup('/trip/t1/expenses', { paymentMethods: [suica] }, [
      { id: 'top', date: '2026-03-15', description: '儲值', amount: 5000, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'pay.credit', topUpFor: 'suica', categoryId: '' },
    ])
    const row = await screen.findByRole('button', { name: /^儲值/ })
    expect(row.querySelector('.tabler-icon-wallet')).not.toBeNull()
    expect(row.querySelector('.tabler-icon-question-mark')).toBeNull()
  })

  it('asks for no category on the top-up form', async () => {
    const { user } = await setup('/trip/t1/expense/new?topUp=suica', { paymentMethods: [suica] })
    await screen.findByRole('heading', { name: t('topUp.title', { name: 'Suica' }) })
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    expect(screen.queryByRole('radiogroup', { name: t('expense.category') })).not.toBeInTheDocument()
  })

  it('keeps top-ups out of the category filter', async () => {
    const { user } = await setup('/trip/t1/expenses', { paymentMethods: [suica] }, [
      { id: 'top', date: '2026-03-15', description: '儲值', amount: 5000, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'pay.credit', topUpFor: 'suica', categoryId: '' },
      { id: 'lunch', date: '2026-03-15', description: '午餐', amount: 300, currency: 'TWD', exchangeRate: 1, paymentMethodId: 'pay.cash' },
    ])
    await user.click(await screen.findByRole('button', { name: t('expenses.filter') }))
    const categories = within(within(screen.getByRole('dialog', { name: t('expenses.filter') })).getByRole('group', { name: t('expense.category') }))
    expect(categories.queryByRole('button', { name: t('cat.none') })).not.toBeInTheDocument()
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
    expect(screen.getByTestId('stored-note')).toHaveTextContent(plain(t('stored.fromBalance', { name: 'Suica', amount: formatMoney(500000, 'JPY') })))
    await user.click(screen.getByLabelText(t('expense.amount')))
    for (const k of ['2', '0', '0']) await user.click(screen.getByRole('button', { name: k }))
    await user.click(screen.getByLabelText(t('expense.description')))
    await user.type(screen.getByLabelText(t('expense.description')), '地鐵')
    await pickCategory(user)
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(async () => expect((await stores.repo.listExpenses('t1')).find((e) => e.description === '地鐵')).toMatchObject({ fromBalance: true, currency: 'JPY' }))
  })

  // task#137：儲值 5,000 円只是把錢放進卡裡，不算花費；用卡付的 200 円 = NT$40 才算
  it('counts the card payment in spending but not the top-up, and tags both in the list', async () => {
    await setup('/trip/t1/expenses', { paymentMethods: [suica] }, [
      { id: 'top', date: '2026-03-15', description: '儲值', amount: 5000, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'pay.credit', topUpFor: 'suica' },
      { id: 'ride', date: '2026-03-15', description: '地鐵', amount: 200, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'suica', fromBalance: true },
    ])
    expect(screen.getByText(plain(t('expenses.spent', { amount: formatMoney(4000, 'TWD') })))).toBeInTheDocument()
    expect(screen.getByRole('region')).toHaveTextContent(plain(t('expenses.dayTotal', { amount: formatMoney(4000, 'TWD') })))
    expect(screen.getByRole('button', { name: /^地鐵/ })).toHaveTextContent(t('stored.paidWith', { name: 'Suica' }))
    expect(screen.getByRole('button', { name: /^儲值/ })).toHaveTextContent(t('stored.topUpTag', { name: 'Suica' }))
  })

  it('explains on the read-only view of a top-up that it is not counted, and says nothing on a card payment', async () => {
    const { stores } = await setup('/trip/t1/expense/top', { paymentMethods: [suica] }, [
      { id: 'top', description: '儲值', amount: 5000, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'pay.credit', topUpFor: 'suica' },
      { id: 'ride', description: '地鐵', amount: 200, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'suica', fromBalance: true },
    ])
    expect(await screen.findByTestId('top-up-note')).toHaveTextContent(t('stored.notCounted', { name: 'Suica' }))
    cleanup()
    await renderApp('/trip/t1/expense/ride', stores)
    expect(await screen.findByRole('heading', { name: '地鐵' })).toBeInTheDocument()
    expect(screen.queryByTestId('top-up-note')).not.toBeInTheDocument()
  })

  // task#137：結算也一樣——用卡付的由分攤的人負擔，儲值不進結算
  it('settles the card payment between the people who shared it, and leaves the top-up out', () => {
    const trip = makeTrip({ baseCurrency: 'TWD', paymentMethods: [suica] })
    const records = [
      makeExpense({ id: 'top', amount: 5000, currency: 'JPY', exchangeRate: 0.2, paidBy: 'a', paymentMethodId: 'pay.credit', topUpFor: 'suica', split: { mode: 'even', participants: ['a'] } }),
      makeExpense({ id: 'ride', amount: 200, currency: 'JPY', exchangeRate: 0.2, paidBy: 'a', paymentMethodId: 'suica', fromBalance: true, split: { mode: 'even', participants: ['a', 'b'] } }),
    ]
    const net = netBalances(trip, records, [])
    expect(net.find((b) => b.memberId === 'b')?.netMinor).toBe(-2000)
    expect(net.find((b) => b.memberId === 'a')?.netMinor).toBe(2000)
  })
})

describe('exchange rates for stored-value records (task#137)', () => {
  // 儲值不算進合計，換成本位幣沒有意義
  it('needs no rate for a top-up, which saves as a finished record', async () => {
    const { user, stores } = await setup('/trip/t1/expense/new?topUp=suica', { paymentMethods: [suica], rates: { default: {}, byMethod: {} } })
    await screen.findByRole('heading', { name: t('topUp.title', { name: 'Suica' }) })
    await user.click(screen.getByLabelText(t('expense.amount')))
    for (const k of ['5', '0', '0', '0']) await user.click(screen.getByRole('button', { name: k }))
    await user.click(screen.getByLabelText(t('expense.description')))
    expect(screen.getByText(t('expense.rateNotNeeded'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(async () => expect((await stores.repo.listExpenses('t1'))[0]).toMatchObject({ topUpFor: 'suica', exchangeRate: 0 }))
    expect((await stores.repo.listExpenses('t1'))[0]).not.toHaveProperty('draft')
  })

  // 用卡付的是真的花費：沒有匯率就跟其他支出一樣存成草稿
  it('asks for a rate when paying with the card, and saves a draft without one', async () => {
    const { user, stores } = await setup('/trip/t1/expense/new', { paymentMethods: [suica], rates: { default: {}, byMethod: {} } })
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    await user.click(within(screen.getByRole('radiogroup', { name: t('expense.paymentMethod') })).getByRole('radio', { name: 'Suica' }))
    await user.click(screen.getByLabelText(t('expense.amount')))
    for (const k of ['2', '0', '0']) await user.click(screen.getByRole('button', { name: k }))
    await user.click(screen.getByLabelText(t('expense.description')))
    expect(screen.getByText(t('expense.noRate', { currency: 'JPY' }))).toBeInTheDocument()
    await user.type(screen.getByLabelText(t('expense.description')), '地鐵')
    await user.click(screen.getByRole('button', { name: t('form.saveDraft') }))
    await waitFor(async () => expect((await stores.repo.listExpenses('t1'))[0]).toMatchObject({ fromBalance: true, draft: true }))
  })
})

describe('stored-value balances in the stats (task#137)', () => {
  it('shows what is left on each card', async () => {
    await setup('/trip/t1/stats', { paymentMethods: [suica] }, [
      { id: 'top', amount: 5000, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'pay.credit', topUpFor: 'suica' },
      { id: 'ride', amount: 200, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'suica', fromBalance: true },
    ])
    expect(await screen.findByTestId('stats-balance-suica')).toHaveTextContent('Suica')
    expect(screen.getByTestId('stats-balance-suica')).toHaveTextContent(plain(formatMoney(480000, 'JPY')))
  })

  // task#138：叫「預存模式餘額」，放在消費明細的正上方
  it('sits right above my spending details', async () => {
    const { user } = await setup('/trip/t1/stats', { paymentMethods: [suica] }, [
      { id: 'top', amount: 5000, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'pay.credit', topUpFor: 'suica' },
      { id: 'ride', amount: 200, currency: 'JPY', exchangeRate: 0.2, paymentMethodId: 'suica', fromBalance: true },
    ])
    await user.click(await screen.findByRole('radio', { name: t('stats.memberSelf', { name: '阿明' }) }))
    const headers = screen.getAllByRole('button', { expanded: true }).map((b) => b.textContent ?? '')
    const balances = headers.findIndex((h) => h.startsWith(t('stats.balances')))
    expect(balances).toBeGreaterThan(-1)
    expect(headers[balances + 1]).toMatch(new RegExp(`^${t('stats.myItems')}`))
  })

  it('has no balances section on a trip without stored-value cards', async () => {
    await setup('/trip/t1/stats')
    expect(await screen.findByRole('button', { name: new RegExp(`^${t('stats.overview')}`) })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: new RegExp(`^${t('stats.balances')}`) })).not.toBeInTheDocument()
  })
})
