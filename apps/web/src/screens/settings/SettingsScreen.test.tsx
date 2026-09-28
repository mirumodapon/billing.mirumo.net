import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { t } from '../../i18n'
import { THEME_KEY } from '../../theme/persistTheme'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())
afterEach(() => vi.unstubAllGlobals())

/** 可控的 prefers-color-scheme：jsdom 沒有 matchMedia */
function stubColorScheme(dark: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    get matches() {
      return dark
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  vi.stubGlobal('matchMedia', () => query)
  return {
    set(next: boolean) {
      dark = next
      listeners.forEach((fn) => fn())
    },
  }
}

async function openSettings(settings = defaultSettings()) {
  const stores = await makeStores()
  await stores.repo.saveSettings(settings)
  return renderApp('/settings', stores)
}

describe('SettingsScreen: language', () => {
  // 規格 6.5：不需重新載入，<html lang> 同步更新
  it('switches language at once and remembers it', async () => {
    const { user, stores } = await openSettings({ ...defaultSettings(), locale: 'zh-TW' })
    expect(screen.getByRole('heading', { level: 1, name: '設定' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'English' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en-US')
    await waitFor(async () => expect((await stores.repo.getSettings()).locale).toBe('en-US'))
  })

  it('names each language in that language, whatever the current one', async () => {
    await openSettings({ ...defaultSettings(), locale: 'en-US' })
    expect(screen.getByRole('radio', { name: '繁體中文' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'English' })).toBeInTheDocument()
  })

  it('goes back to the trip list', async () => {
    const { user } = await openSettings()
    await user.click(screen.getByRole('button', { name: t('common.back') }))
    expect(currentRoute()).toBe('/')
  })
})

describe('SettingsScreen: theme', () => {
  it('applies a chosen theme at once and remembers it for the next boot', async () => {
    const { user, stores } = await openSettings()
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('settings.theme')}`) }))
    const picker = screen.getByRole('dialog', { name: t('settings.theme') })
    // 八個主題都以名稱列出，外加「跟隨系統」
    expect(within(picker).getAllByRole('radio')).toHaveLength(9)
    await user.click(within(picker).getByRole('radio', { name: 'Tokyo Night Moon' }))
    expect(document.documentElement.dataset.theme).toBe('tokyo-night-moon')
    expect(localStorage.getItem(THEME_KEY)).toBe('tokyo-night-moon')
    await waitFor(async () => expect(await stores.repo.getSettings()).toMatchObject({ theme: 'tokyo-night-moon', themeFamily: 'tokyo-night' }))
  })

  it('follows the system within the chosen palette', async () => {
    stubColorScheme(true)
    const { user } = await openSettings({ ...defaultSettings(), theme: 'system', themeFamily: 'catppuccin' })
    expect(document.documentElement.dataset.theme).toBe('catppuccin-mocha')
    await user.click(screen.getByRole('radio', { name: 'Tokyo Night' }))
    expect(document.documentElement.dataset.theme).toBe('tokyo-night')
  })

  it('shows the palette choice only while following the system', async () => {
    await openSettings({ ...defaultSettings(), theme: 'catppuccin-latte' })
    expect(screen.queryByRole('radiogroup', { name: t('settings.themeFamily') })).not.toBeInTheDocument()
  })

  // 傍晚系統切成深色時，使用者多半不在設定頁
  it('re-applies the theme when the system turns dark, on any screen', async () => {
    const scheme = stubColorScheme(false)
    const stores = await makeStores()
    await stores.repo.saveSettings({ ...defaultSettings(), theme: 'system', themeFamily: 'tokyo-night' })
    await renderApp('/', stores)
    expect(document.documentElement.dataset.theme).toBe('tokyo-night-day')
    scheme.set(true)
    expect(document.documentElement.dataset.theme).toBe('tokyo-night')
  })

  it('stops following the system once a theme is chosen', async () => {
    const scheme = stubColorScheme(false)
    await openSettings({ ...defaultSettings(), theme: 'catppuccin-frappe' })
    scheme.set(true)
    expect(document.documentElement.dataset.theme).toBe('catppuccin-frappe')
  })
})

describe('about (Plan 10 Task 7)', () => {
  // 回報問題時要說得出是哪一版：版本來自 package.json，commit 是建置時的 git hash（task#132）
  it('shows the app version and the commit it was built from, as version (hash)', async () => {
    await renderApp('/settings')
    expect(screen.getByTestId('app-version')).toHaveTextContent(`${__APP_VERSION__} (${__APP_COMMIT__})`)
    expect(__APP_COMMIT__).toMatch(/^([0-9a-f]{7,}|dev)$/)
  })
})
