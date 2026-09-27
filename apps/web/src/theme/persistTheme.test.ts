import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
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
  it('uses the same keys the inline boot script reads', () => {
    const html = readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8')
    expect(html).toContain(`localStorage.getItem('${THEME_KEY}')`)
    expect(html).toContain(`localStorage.getItem('${THEME_FAMILY_KEY}')`)
  })
})
