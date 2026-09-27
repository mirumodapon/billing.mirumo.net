import type { ExchangeRateTable } from '@billing/core'
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession } from '../../data/session'
import { makeTrip } from '../../data/testing/fixtures'
import { fetchRate } from '../../domain/fetchRate'
import { t } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

vi.mock('../../domain/fetchRate', () => ({ fetchRate: vi.fn() }))
const mockedFetch = vi.mocked(fetchRate)

beforeEach(() => {
  clearSession()
  mockedFetch.mockReset()
})

async function setup(rates: ExchangeRateTable = { default: {}, byMethod: {} }) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD', rates }))
  const app = await renderApp('/trip/t1/setup', stores)
  await app.user.click(screen.getByRole('button', { name: new RegExp(`^${t('rates.title')}`) }))
  return { ...app, panel: within(screen.getByTestId('section-rates-panel')) }
}

const rates = async (stores: Awaited<ReturnType<typeof setup>>['stores']) => (await stores.repo.getTrip('t1'))!.rates
const key = (name: string) => screen.getByRole('button', { name })
const card = (currency: string) => within(screen.getByRole('region', { name: currency }))

async function typeOnKeypad(user: Awaited<ReturnType<typeof setup>>['user'], keys: string[]) {
  for (const k of keys) await user.click(key(k))
  await user.click(key(t('keypad.done')))
}

describe('RatesSection', () => {
  it('shows one card per currency with its default and payment-method rates', async () => {
    await setup({ default: { JPY: 0.21 }, byMethod: { 'JPY|pay.cash': 0.215 } })
    const jpy = card('JPY')
    expect(jpy.getByRole('button', { name: new RegExp(t('rates.default')) })).toHaveTextContent('0.21')
    // 內建付款方式的名稱經過翻譯，而不是顯示 'pay.cash'
    expect(jpy.getByRole('button', { name: new RegExp(t('pay.cash')) })).toHaveTextContent('0.215')
  })

  it('adds a currency and leaves its rate unset until one is entered', async () => {
    const { user, panel, stores } = await setup({ default: { JPY: 0.21 }, byMethod: {} })
    await user.click(panel.getByRole('button', { name: t('rates.addCurrency') }))
    const picker = screen.getByRole('dialog', { name: t('rates.addCurrency') })
    // 已加入的幣別與本位幣不重複出現
    expect(within(picker).queryByRole('radio', { name: /^JPY/ })).not.toBeInTheDocument()
    expect(within(picker).queryByRole('radio', { name: /^TWD/ })).not.toBeInTheDocument()
    await user.click(within(picker).getByRole('radio', { name: /^KRW/ }))
    expect(card('KRW').getByRole('button', { name: new RegExp(t('rates.default')) })).toHaveTextContent(t('budget.notSet'))
    // 沒輸入就不存：存 0 會讓每筆韓圜支出都換算成 0
    expect('KRW' in (await rates(stores)).default).toBe(false)
  })

  it('saves an entered rate', async () => {
    const { user, stores } = await setup({ default: { KRW: 0.02 }, byMethod: {} })
    await user.click(card('KRW').getByRole('button', { name: new RegExp(t('rates.default')) }))
    await user.click(key(t('keypad.clear')))
    await typeOnKeypad(user, ['0', '.', '0', '2', '3', '5'])
    await waitFor(async () => expect((await rates(stores)).default.KRW).toBe(0.0235))
  })

  it('adds a rate for one payment method under a currency', async () => {
    const { user, stores } = await setup({ default: { JPY: 0.21 }, byMethod: {} })
    await user.click(card('JPY').getByRole('button', { name: t('rates.addMethod') }))
    await user.click(within(screen.getByRole('dialog', { name: t('rates.addMethod') })).getByRole('radio', { name: t('pay.credit') }))
    await user.click(card('JPY').getByRole('button', { name: new RegExp(t('pay.credit')) }))
    await typeOnKeypad(user, ['0', '.', '2', '1', '2', '8'])
    await waitFor(async () => expect((await rates(stores)).byMethod['JPY|pay.credit']).toBe(0.2128))
  })

  // 規格 4.7：抓到的值只填進欄位供參考調整，不自動套用
  it('fills in the market rate for checking, and saves it only on done', async () => {
    mockedFetch.mockResolvedValue({ ok: true, rate: 0.2123 })
    const { user, stores } = await setup({ default: { JPY: 0.21 }, byMethod: {} })
    await user.click(card('JPY').getByRole('button', { name: t('rates.fetch', { currency: 'JPY' }) }))
    expect(mockedFetch).toHaveBeenCalledWith('JPY', 'TWD')
    expect(await screen.findByTestId('calc-expression')).toHaveTextContent('0.2123')
    expect(screen.getByText(new RegExp(t('rates.fetched')))).toBeInTheDocument()
    expect((await rates(stores)).default.JPY).toBe(0.21)
    await user.click(key(t('keypad.done')))
    await waitFor(async () => expect((await rates(stores)).default.JPY).toBe(0.2123))
  })

  it('says so when offline and keeps the old value', async () => {
    mockedFetch.mockResolvedValue({ ok: false, reason: 'offline' })
    const { user, stores } = await setup({ default: { JPY: 0.21 }, byMethod: {} })
    await user.click(card('JPY').getByRole('button', { name: t('rates.fetch', { currency: 'JPY' }) }))
    expect(await screen.findByText(t('rates.offline'))).toBeInTheDocument()
    expect(screen.queryByTestId('calc-expression')).not.toBeInTheDocument()
    expect((await rates(stores)).default.JPY).toBe(0.21)
  })

  it('removes a currency with all of its rates', async () => {
    const { user, stores } = await setup({
      default: { JPY: 0.21, KRW: 0.02 },
      byMethod: { 'JPY|pay.cash': 0.215, 'JPY|pay.credit': 0.213, 'KRW|pay.cash': 0.021 },
    })
    await user.click(card('JPY').getByRole('button', { name: t('rates.removeCurrency', { currency: 'JPY' }) }))
    await waitFor(async () =>
      expect(await rates(stores)).toEqual({ default: { KRW: 0.02 }, byMethod: { 'KRW|pay.cash': 0.021 } }),
    )
    expect(screen.queryByRole('region', { name: 'JPY' })).not.toBeInTheDocument()
  })

  it('removes a payment-method rate when it is cleared', async () => {
    const { user, stores } = await setup({ default: { JPY: 0.21 }, byMethod: { 'JPY|pay.cash': 0.215 } })
    await user.click(card('JPY').getByRole('button', { name: new RegExp(t('pay.cash')) }))
    await user.click(key(t('keypad.clear')))
    await user.click(key(t('keypad.done')))
    await waitFor(async () => expect((await rates(stores)).byMethod).toEqual({}))
  })

  it('explains the table when there are no other currencies yet', async () => {
    const { panel } = await setup()
    expect(panel.getByText(t('rates.empty', { base: 'TWD' }))).toBeInTheDocument()
  })
})
