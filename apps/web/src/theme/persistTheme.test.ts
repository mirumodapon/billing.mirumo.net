import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSystemTheme } from '@billing/ui'
import { describe, expect, it, vi } from 'vitest'
import { persistTheme, THEME_FAMILY_KEY, THEME_KEY } from './persistTheme'

function fakeStorage() {
  const map = new Map<string, string>()
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage
  return { map, store }
}

describe('persistTheme', () => {
  it('applies the theme and mirrors both keys for the inline boot script', () => {
    const { map, store } = fakeStorage()
    expect(persistTheme('tokyo-night-moon', 'tokyo-night', store)).toBe('tokyo-night-moon')
    expect(document.documentElement.dataset.theme).toBe('tokyo-night-moon')
    expect(map.get(THEME_KEY)).toBe('tokyo-night-moon')
    expect(map.get(THEME_FAMILY_KEY)).toBe('tokyo-night')
  })

  // 存「選擇」而不是解析結果：存成 catppuccin-latte 的話，下次開機就不再跟隨系統明暗
  it('stores "system" rather than the theme it resolved to', () => {
    const { map, store } = fakeStorage()
    const applied = persistTheme('system', 'catppuccin', store)
    expect(applied).not.toBe('system')
    expect(map.get(THEME_KEY)).toBe('system')
  })

  it('still applies the theme when storage throws', () => {
    const store = {
      setItem: () => {
        throw new Error('quota')
      },
    } as unknown as Storage
    expect(() => persistTheme('catppuccin-frappe', 'catppuccin', store)).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('catppuccin-frappe')
  })

  /*
   * index.html 的 inline script 讀的是寫死的字串，不能 import。兩邊的 key 一旦
   * 不一致，設定頁切的主題下次開機就不會生效，而且沒有任何錯誤。
   * HTML 不進 jsdom，所以只能讀原始碼比對。
   */
  /*
   * 開機 script 自己挑「跟隨系統」的主題（它不能 import），settingsStore 載入後再用
   * resolveSystemTheme 挑一次。兩邊挑得不一樣，冷啟動就會先畫一個、再換成另一個。
   * 這裡真的執行那段 script，逐一比對兩個家族 × 深淺偏好。
   */
  it.each([
    ['catppuccin', false],
    ['catppuccin', true],
    ['tokyo-night', false],
    ['tokyo-night', true],
  ] as const)('boots %s (dark: %s) into the theme the app will resolve to', (family, dark) => {
    const html = readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8')
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!
    const saved: Record<string, string> = { [THEME_KEY]: 'system', [THEME_FAMILY_KEY]: family }
    vi.stubGlobal('localStorage', { getItem: (k: string) => saved[k] ?? null })
    vi.stubGlobal('matchMedia', () => ({ matches: dark }))
    try {
      document.documentElement.removeAttribute('data-theme')
      new Function(script)()
      expect(document.documentElement.dataset.theme).toBe(resolveSystemTheme(family))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('uses the same keys the inline boot script reads', () => {
    const html = readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8')
    expect(html).toContain(`localStorage.getItem('${THEME_KEY}')`)
    expect(html).toContain(`localStorage.getItem('${THEME_FAMILY_KEY}')`)
  })
})
