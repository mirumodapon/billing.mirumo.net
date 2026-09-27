import { createStore, type StoreApi } from 'zustand/vanilla'
import { defaultSettings } from '../data/defaults'
import type { TripRepository } from '../data/tripRepository'
import type { AppSettings } from '../data/types'
import { detectLocale, setLocale, t, type Locale } from '../i18n'
import { persistTheme } from '../theme/persistTheme'
import type { UiState } from './uiStore'

export interface SettingsState {
  settings: AppSettings
  /** settings.locale 解析 'system' 之後實際使用的語系 */
  locale: Locale
  loaded: boolean
  load(): Promise<void>
  /** 樂觀更新：立刻生效，落盤失敗則回滾並跳 snackbar（規格 7.5） */
  update(change: (s: AppSettings) => AppSettings): Promise<void>
}

export function resolveLocale(pref: AppSettings['locale'], detect: () => Locale = detectLocale): Locale {
  return pref === 'system' ? detect() : pref
}

export function createSettingsStore({ repo, ui }: { repo: TripRepository; ui: StoreApi<UiState> }): StoreApi<SettingsState> {
  // 每次 update 領一個序號。慢慢失敗的舊寫入只有在「後面沒有新的變更」時才回滾，
  // 否則會把使用者剛做的、已經存成功的選擇蓋回去
  let version = 0

  /*
   * 先 setLocale 再 set：t() 讀的是 i18n 模組裡的變數，訂閱 store 的元件
   * 一重繪就會呼叫 t()，那一刻語系必須已經換好。
   */
  const apply = (settings: AppSettings) => {
    const locale = resolveLocale(settings.locale)
    setLocale(locale)
    persistTheme(settings.theme, settings.themeFamily)
    return { settings, locale }
  }

  return createStore<SettingsState>((set, get) => ({
    settings: defaultSettings(),
    locale: resolveLocale('system'),
    loaded: false,

    async load() {
      try {
        set({ ...apply(await repo.getSettings()), loaded: true })
      } catch {
        // 讀不到也要讓 app 開得起來：用預設值，並告訴使用者
        set({ ...apply(defaultSettings()), loaded: true })
        ui.getState().show({ id: 'load-failed', message: t('error.loadFailed') })
      }
    },

    async update(change) {
      const previous = get().settings
      const next = change(previous)
      const mine = ++version
      set(apply(next))
      try {
        await repo.saveSettings(next)
      } catch {
        if (mine === version) set(apply(previous))
        ui.getState().show({ id: 'save-failed', message: t('error.saveFailed') })
      }
    },
  }))
}
