import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../data/session'
import { makeExpense, makeTrip } from '../data/testing/fixtures'
import { LAST_EXPORT_KEY } from '../domain/backup'
import { formatDateRange, formatMoney } from '../i18n/format'
import { t } from '../i18n'
import { currentRoute, makeStores, renderApp } from '../test/renderApp'
import { confirmDelete } from '../test/confirmDelete'

beforeEach(() => {
  clearSession()
  // 旅程都在 3 月結束：先當作剛匯出過，備份提醒卡才不會混進這裡的旅程卡片
  localStorage.setItem(LAST_EXPORT_KEY, '2999-01-01T00:00:00.000Z')
})

async function withTrips() {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 'a', name: '東京', startDate: '2026-03-14', endDate: '2026-03-18', budget: { total: 10000, scope: 'group' } }))
  await stores.repo.saveTrip(makeTrip({ id: 'b', name: '首爾', startDate: '2026-01-02', endDate: '2026-01-05', budget: { scope: 'group' } }))
  await stores.repo.saveExpense(makeExpense({ tripId: 'a', amount: 2500, currency: 'TWD', exchangeRate: 1 }))
  return renderApp('/', stores)
}

// Intl 的日期區間與金額含細空白、不換行空白；畫面文字會被正規化成一般空白，預期值也要
const plain = (s: string) => s.replace(/\s+/g, ' ')

const card = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })

describe('TripListScreen', () => {
  it('shows an empty state and a way to add the first trip', async () => {
    await renderApp('/')
    expect(screen.getByText(t('tripList.empty'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('trip.new') })).toBeInTheDocument()
  })

  // task#123：這裡沒有分頁列，新增鍵不必替它讓位，底部與右邊的距離一致
  it('places the add button without room for a tab bar', async () => {
    await renderApp('/')
    expect(screen.getByRole('button', { name: t('trip.new') })).toHaveClass('bi-fab--no-tabbar')
  })

  it('lists trips newest first with their dates and spending', async () => {
    await withTrips()
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titles).toEqual(['東京', '首爾'])
    expect(card('東京')).toHaveTextContent(plain(formatDateRange('2026-03-14', '2026-03-18')))
    expect(card('東京')).toHaveTextContent(plain(t('tripList.spent', { amount: formatMoney(2500, 'TWD') })))
  })

  // 規格 3.6：沒設預算就不畫進度條
  it('shows a budget bar only for a trip with a budget', async () => {
    await withTrips()
    expect(within(card('東京')).getByRole('progressbar', { name: t('tripList.budget', { percent: 25 }) })).toBeInTheDocument()
    expect(within(card('首爾')).queryByRole('progressbar')).not.toBeInTheDocument()
    // task#116：沒有預算的卡片留出同樣高度的空位，列表裡的卡片才會一樣高
    expect(card('首爾').querySelector('.app-card__bar-slot')).not.toBeNull()
    expect(card('東京').querySelector('.app-card__bar-slot')).toBeNull()
  })

  it('opens a trip on its expenses tab', async () => {
    const { user } = await withTrips()
    await user.click(card('東京'))
    expect(currentRoute()).toBe('/trip/a/expenses')
  })

  // 刪除一律先確認（取代規格 4.2 的「不跳確認」），刪了仍可從 snackbar 復原
  it('asks before deleting a trip, then brings it back with undo', async () => {
    const { user } = await withTrips()
    const deleteButtons = screen.getAllByRole('button', { name: t('common.delete') })
    await user.click(deleteButtons[0]!)
    expect(screen.getByRole('heading', { name: '東京' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: t('confirm.deleteTitle', { name: '東京' }) })).toHaveTextContent(t('confirm.undoable'))
    await confirmDelete(user, '東京')
    expect(screen.queryByRole('heading', { name: '東京' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: t('common.undo') }))
    expect(await screen.findByRole('heading', { name: '東京' })).toBeInTheDocument()
  })

  it('keeps the trip when the delete is cancelled', async () => {
    const { user, stores } = await withTrips()
    await user.click(screen.getAllByRole('button', { name: t('common.delete') })[0]!)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('common.cancel') }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '東京' })).toBeInTheDocument()
    expect((await stores.repo.listTrips()).map((trip) => trip.name)).toContain('東京')
  })

  it('opens global settings from the app bar', async () => {
    const { user } = await renderApp('/')
    await user.click(screen.getByRole('button', { name: t('tripList.settings') }))
    expect(currentRoute()).toBe('/settings')
  })
})

// 規格 5.5：往深處走由右滑入，回到列表由左滑回
describe('page transition', () => {
  it('slides forward into a trip and back out to the list', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京' }))
    const { user } = await renderApp('/', stores)
    await user.click(screen.getByRole('button', { name: /東京/ }))
    expect(screen.getByTestId('page')).toHaveAttribute('data-direction', 'forward')
    await user.click(screen.getByRole('button', { name: t('common.back') }))
    expect(screen.getByTestId('page')).toHaveAttribute('data-direction', 'back')
  })
})
