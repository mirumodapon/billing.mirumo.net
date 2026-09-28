import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession } from '../data/session'
import { makeTrip } from '../data/testing/fixtures'
import { LAST_EXPORT_KEY } from '../domain/backup'
import { setDeferredPromptForTest, type InstallPromptEvent } from '../domain/install'
import { t } from '../i18n'
import { makeStores, renderApp } from '../test/renderApp'

beforeEach(() => {
  clearSession()
  localStorage.clear()
  sessionStorage.clear()
  // 沒有要測備份提醒的測試，先當作剛匯出過
  localStorage.setItem(LAST_EXPORT_KEY, '2999-01-01T00:00:00.000Z')
})
afterEach(() => {
  setDeferredPromptForTest(null)
  Reflect.deleteProperty(navigator, 'userAgent')
  Reflect.deleteProperty(window, 'matchMedia')
})

async function withTrip(trip = makeTrip({ id: 't1', name: '東京', startDate: '2026-03-14', endDate: '2026-03-18' })) {
  const stores = await makeStores()
  await stores.repo.saveTrip(trip)
  return renderApp('/', stores)
}

function fakePrompt() {
  const prompt = vi.fn(async () => {})
  const event = Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) })
  setDeferredPromptForTest(event as unknown as InstallPromptEvent)
  return prompt
}

describe('install card (spec 7.4, Plan 10 P6)', () => {
  it('offers the system install prompt once there is a trip', async () => {
    const prompt = fakePrompt()
    const { user } = await withTrip()
    const card = within(screen.getByTestId('install-card'))
    await user.click(card.getByRole('button', { name: t('install.now') }))
    expect(prompt).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByTestId('install-card')).not.toBeInTheDocument())
  })

  it('does not show before the first trip exists', async () => {
    fakePrompt()
    await renderApp('/')
    expect(screen.queryByTestId('install-card')).not.toBeInTheDocument()
  })

  // iOS 沒有安裝 API：用圖示教「分享 → 加入主畫面」
  it('teaches the Share → Add to Home Screen steps on an iPhone', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', configurable: true })
    await withTrip()
    const card = within(screen.getByTestId('install-card'))
    expect(card.getByText(t('install.iosShare'))).toBeInTheDocument()
    expect(card.getByRole('img', { name: t('install.shareIcon') })).toBeInTheDocument()
    expect(card.queryByRole('button', { name: t('install.now') })).not.toBeInTheDocument()
  })

  it('stays away on browsers that cannot install and are not iOS', async () => {
    await withTrip()
    expect(screen.queryByTestId('install-card')).not.toBeInTheDocument()
  })

  it('does not show when already opened from the home screen', async () => {
    fakePrompt()
    Object.defineProperty(window, 'matchMedia', {
      value: (q: string) => ({ matches: q === '(display-mode: standalone)', addEventListener() {}, removeEventListener() {} }),
      configurable: true,
    })
    await withTrip()
    expect(screen.queryByTestId('install-card')).not.toBeInTheDocument()
  })

  it('goes away for good once dismissed', async () => {
    fakePrompt()
    const { user } = await withTrip()
    await user.click(within(screen.getByTestId('install-card')).getByRole('button', { name: t('install.dismiss') }))
    expect(screen.queryByTestId('install-card')).not.toBeInTheDocument()
    location.hash = '#/settings'
    await screen.findByRole('heading', { name: t('settings.title') })
    location.hash = '#/'
    await screen.findByRole('heading', { name: '東京' })
    expect(screen.queryByTestId('install-card')).not.toBeInTheDocument()
  })
})

describe('backup reminder (spec 7.4, Plan 10 P7)', () => {
  beforeEach(() => localStorage.removeItem(LAST_EXPORT_KEY))

  it('asks for a backup once a trip has ended', async () => {
    await withTrip()
    expect(within(screen.getByTestId('backup-reminder')).getByRole('heading', { name: t('reminder.title', { name: '東京' }) })).toBeInTheDocument()
  })

  it('stays quiet while the trip is still under way', async () => {
    await withTrip(makeTrip({ id: 't1', name: '將來', startDate: '2999-01-01', endDate: '2999-01-05' }))
    expect(screen.queryByTestId('backup-reminder')).not.toBeInTheDocument()
  })

  it('hides for this session when put off', async () => {
    const { user } = await withTrip()
    await user.click(within(screen.getByTestId('backup-reminder')).getByRole('button', { name: t('reminder.later') }))
    expect(screen.queryByTestId('backup-reminder')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('bi-backup-snoozed')).toBe('1')
  })
})
