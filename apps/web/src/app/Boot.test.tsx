import { act, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { clearSession, readSession, writeSession } from '../data/session'
import { makeTrip } from '../data/testing/fixtures'
import { t } from '../i18n'
import { currentRoute, makeStores, mountApp, renderApp } from '../test/renderApp'

beforeEach(() => clearSession())

/** 記下掛載到結束之間，畫面上曾經出現過的文字 */
function watchText(): { seen: () => string; stop: () => void } {
  let seen = ''
  const observer = new MutationObserver(() => {
    seen += document.body.textContent ?? ''
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  return { seen: () => seen + (document.body.textContent ?? ''), stop: () => observer.disconnect() }
}

describe('Boot', () => {
  it('opens on the saved trip page without ever showing the trip list', async () => {
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京' }))
    history.replaceState(null, '', '#/trip/t1/stats')
    const watch = watchText()
    await mountApp(stores)
    await screen.findByRole('heading', { name: '東京' })
    watch.stop()
    expect(watch.seen()).not.toContain(t('tripList.title'))
    expect(currentRoute()).toBe('/trip/t1/stats')
  })

  // 規格 7.9 第 3 步：旅程已刪除 → 靜默退回列表並清掉 session
  it('falls back to the trip list, silently, when the saved trip is gone', async () => {
    writeSession({ route: '/trip/gone/setup', tripId: 'gone' })
    const { stores } = await renderApp('/trip/gone/setup')
    expect(currentRoute()).toBe('/')
    expect(screen.getByRole('heading', { name: t('tripList.title') })).toBeInTheDocument()
    expect(readSession()?.route).toBe('/')
    expect(stores.ui.getState().queue).toEqual([])
  })

  it('shows the first screen in the saved language', async () => {
    const stores = await makeStores()
    await stores.repo.saveSettings({ ...defaultSettings(), locale: 'en-US' })
    await renderApp('/', stores)
    expect(screen.getByRole('heading', { name: 'My trips' })).toBeInTheDocument()
  })

  it('marks the loading skeleton busy for assistive tech', async () => {
    const stores = await makeStores()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const load = stores.settings.getState().load
    stores.settings.setState({ load: () => gate.then(load) })
    await mountApp(stores)
    const boot = await screen.findByTestId('boot')
    expect(boot).toHaveAttribute('aria-busy', 'true')
    await act(async () => release())
    await waitFor(() => expect(screen.queryByTestId('boot')).not.toBeInTheDocument())
  })

  it('sends unknown addresses to the trip list', async () => {
    await renderApp('/nowhere')
    expect(currentRoute()).toBe('/')
  })
})
