import { enUS, enUSPlurals } from './en-US'
import { zhTW, zhTWPlurals, type PluralKey, type TranslationKey } from './zh-TW'

export type Locale = 'zh-TW' | 'en-US'
export type { PluralKey, TranslationKey }

const STRINGS = { 'zh-TW': zhTW, 'en-US': enUS } as const
const PLURALS = { 'zh-TW': zhTWPlurals, 'en-US': enUSPlurals } as const

let active: Locale = 'zh-TW'

export function getLocale(): Locale {
  return active
}

export function setLocale(locale: Locale): void {
  active = locale
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

/** 偵測系統語言，不支援的一律回 zh-TW */
export function detectLocale(): Locale {
  const wanted = globalThis.navigator?.languages ?? []
  for (const tag of wanted) {
    if (tag.startsWith('en')) return 'en-US'
    if (tag.startsWith('zh')) return 'zh-TW'
  }
  return 'zh-TW'
}

type Params = Record<string, string | number>

function interpolate(template: string, params: Params): string {
  // 找不到的 placeholder 原樣留著：讓開發者看到 {to}，而不是讓使用者看到 undefined
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export function t(key: TranslationKey, params: Params = {}): string {
  return interpolate(STRINGS[active][key], params)
}

export function tPlural(key: PluralKey, params: Params & { count: number }): string {
  const entry = PLURALS[active][key]
  const form =
    typeof entry === 'string'
      ? entry
      : new Intl.PluralRules(active).select(params.count) === 'one'
        ? entry.one
        : entry.other
  return interpolate(form, params)
}
