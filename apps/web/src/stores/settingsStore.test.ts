import { resolveSystemTheme } from '@billing/ui'
import { describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { getLocale, t } from '../i18n'
import { openTestRepo } from '../test/renderApp'
import { createSettingsStore, resolveLocale } from './settingsStore'
import { createUiStore } from './uiStore'

async function setup() {
  const repo = await openTestRepo()
  const ui = createUiStore()
  const settings = createSettingsStore({ repo, ui })
  return { repo, ui, settings }
}

describe('resolveLocale', () => {
  it('follows the system when asked to', () => {
    expect(resolveLocale('system', () => 'en-US')).toBe('en-US')
  })

  it('uses an explicit choice over the system', () => {
    expect(resolveLocale('zh-TW', () => 'en-US')).toBe('zh-TW')
  })
})

describe('settingsStore', () => {
  it('loads saved settings and applies their language and theme', async () => {
    const { repo, settings } = await setup()
    await repo.saveSettings({ ...defaultSettings(), locale: 'en-US', theme: 'catppuccin-latte' })
    await settings.getState().load()
    expect(settings.getState()).toMatchObject({ loaded: true, locale: 'en-US' })
    expect(getLocale()).toBe('en-US')
    expect(document.documentElement.lang).toBe('en-US')
    expect(document.documentElement.dataset.theme).toBe('catppuccin-latte')
  })

  it('falls back to the defaults and says so when settings cannot be read', async () => {
    const { repo, ui, settings } = await setup()
    vi.spyOn(repo, 'getSettings').mockRejectedValueOnce(new Error('broken'))
    // 上一個畫面留下的主題：fallback 必須真的套用預設值，而不是只把 loaded 設成 true
    document.documentElement.dataset.theme = 'tokyo-night'
    await settings.getState().load()
    expect(document.documentElement.dataset.theme).toBe(resolveSystemTheme('catppuccin'))
    expect(settings.getState().loaded).toBe(true)
    expect(settings.getState().settings).toEqual(defaultSettings())
    expect(ui.getState().queue[0]?.message).toBe(t('error.loadFailed'))
  })

  // 規格 7.5：先改記憶體讓畫面立刻反應，再非同步落盤
  it('applies a change before it is saved', async () => {
    const { settings } = await setup()
    await settings.getState().load()
    const saving = settings.getState().update((s) => ({ ...s, locale: 'en-US' }))
    expect(settings.getState().locale).toBe('en-US')
    expect(getLocale()).toBe('en-US')
    await saving
  })

  it('persists a change', async () => {
    const { repo, settings } = await setup()
    await settings.getState().load()
    await settings.getState().update((s) => ({ ...s, theme: 'tokyo-night-storm', themeFamily: 'tokyo-night' }))
    expect(await repo.getSettings()).toMatchObject({ theme: 'tokyo-night-storm', themeFamily: 'tokyo-night' })
    expect(document.documentElement.dataset.theme).toBe('tokyo-night-storm')
  })

  // 規格 7.5：落盤失敗 → 回滾記憶體 + snackbar
  it('rolls back and reports when saving fails', async () => {
    const { repo, ui, settings } = await setup()
    await settings.getState().update((s) => ({ ...s, locale: 'zh-TW' }))
    vi.spyOn(repo, 'saveSettings').mockRejectedValueOnce(new Error('quota'))
    await settings.getState().update((s) => ({ ...s, locale: 'en-US' }))
    expect(settings.getState().settings.locale).toBe('zh-TW')
    expect(settings.getState().locale).toBe('zh-TW')
    expect(getLocale()).toBe('zh-TW')
    expect(ui.getState().queue[0]?.message).toBe(t('error.saveFailed'))
  })

  // 兩次快速切換，第一次慢慢失敗、第二次成功：回滾不能把第二次的結果蓋掉
  it('does not roll back over a later change', async () => {
    const { repo, settings } = await setup()
    await settings.getState().update((s) => ({ ...s, locale: 'zh-TW' }))
    let reject!: (e: Error) => void
    vi.spyOn(repo, 'saveSettings').mockImplementationOnce(() => new Promise((_, r) => (reject = r)))
    const first = settings.getState().update((s) => ({ ...s, theme: 'catppuccin-latte' }))
    await settings.getState().update((s) => ({ ...s, locale: 'en-US' }))
    reject(new Error('quota'))
    await first
    expect(settings.getState().settings.locale).toBe('en-US')
    expect(getLocale()).toBe('en-US')
  })
})
