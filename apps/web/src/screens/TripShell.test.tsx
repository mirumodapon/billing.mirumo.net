import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../data/session'
import { makeTrip } from '../data/testing/fixtures'
import { t } from '../i18n'
import { currentRoute, makeStores, renderApp } from '../test/renderApp'

beforeEach(() => clearSession())

async function withTrip(route = '/trip/t1/expenses') {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京' }))
  return renderApp(route, stores)
}

describe('TripShell', () => {
  it('shows the trip name, the tab content and four tabs', async () => {
    await withTrip('/trip/t1/stats')
    expect(screen.getByRole('heading', { name: '東京' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: t('stats.scope') })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByRole('tab', { name: t('tab.stats') })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the expenses tab when no tab is named', async () => {
    await withTrip('/trip/t1')
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
  })

  // 切 tab 不累積返回紀錄：返回鍵應該直接回旅程列表
  it('switches tabs without adding to the history', async () => {
    const { user } = await withTrip()
    const before = history.length
    await user.click(screen.getByRole('tab', { name: t('tab.setup') }))
    expect(currentRoute()).toBe('/trip/t1/setup')
    expect(screen.getByTestId('setup-tab')).toBeInTheDocument()
    expect(history.length).toBe(before)
  })

  it('goes back to the trip list', async () => {
    const { user } = await withTrip()
    await user.click(screen.getByRole('button', { name: t('common.back') }))
    expect(currentRoute()).toBe('/')
  })

  it('loads the trip’s records while open and forgets them on leaving', async () => {
    const { stores, user } = await withTrip()
    expect(stores.trips.getState().current?.tripId).toBe('t1')
    await user.click(screen.getByRole('button', { name: t('common.back') }))
    expect(stores.trips.getState().current).toBeUndefined()
    // 曾經發生過：換頁讓冷啟動重跑，非同步地把剛離開的旅程又載回來。等它有機會發生再看一次
    await new Promise((r) => setTimeout(r, 50))
    expect(stores.trips.getState().current).toBeUndefined()
  })

  it('returns to the trip list for a trip that does not exist', async () => {
    await renderApp('/trip/nope/setup')
    await waitFor(() => expect(currentRoute()).toBe('/'))
  })
})
