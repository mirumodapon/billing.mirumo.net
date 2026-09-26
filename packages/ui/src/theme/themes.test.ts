import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const THEME_DIR = join(import.meta.dirname, '../styles/themes')

/** palette 層的 21 個槽位。少一個，該主題就會沿用上一個主題的殘留值。 */
const PALETTE_SLOTS = [
  'bg', 'bg-sunken', 'bg-deepest',
  'surface1', 'surface2', 'surface3',
  'text', 'text-muted', 'text-subtle',
  ...Array.from({ length: 12 }, (_, i) => `accent${i + 1}`),
]

function themeFiles(): string[] {
  // index.css 是 generate-themes.ts 產生的 @import 聚合檔，不是主題本身：
  // 它既沒有 palette slots 也沒有 color-scheme，混進來掃會誤判成漏寫。
  return readdirSync(THEME_DIR).filter((f) => f.endsWith('.css') && f !== 'index.css')
}

/**
 * 產生器該產出的八個主題，逐字釘住。
 *
 * 其餘測試都是「遍歷目錄裡的每個檔案，檢查它合格」——少一個檔案就只是少跑
 * 一輪迴圈，全部照樣通過。所以必須另外有一條說「該有的都在」，否則產生器
 * 靜靜少產一個主題不會有任何人發現。
 */
const EXPECTED_THEMES = [
  'catppuccin-frappe',
  'catppuccin-latte',
  'catppuccin-macchiato',
  'catppuccin-mocha',
  'tokyo-night',
  'tokyo-night-day',
  'tokyo-night-moon',
  'tokyo-night-storm',
]

describe('theme files', () => {
  it('generates exactly the eight expected themes', () => {
    const ids = themeFiles()
      .map((f) => f.replace('.css', ''))
      .sort()
    expect(ids).toEqual(EXPECTED_THEMES)
  })

  /**
   * 主題檔本身合格，但沒有被 index.css 匯入的話就永遠不會載入——
   * 切到那個主題會什麼都沒有，而檔案看起來完全正常。
   */
  it('index.css imports every theme file', () => {
    const index = readFileSync(join(THEME_DIR, 'index.css'), 'utf8')
    const imported = [...index.matchAll(/@import\s+'\.\/(.+?)\.css'/g)].map((m) => m[1]!).sort()
    expect(imported).toEqual(themeFiles().map((f) => f.replace('.css', '')).sort())
  })

  it('every theme defines all 21 palette slots', () => {
    for (const file of themeFiles()) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      for (const slot of PALETTE_SLOTS) {
        expect(css, `${file} is missing --bi-p-${slot}`).toContain(`--bi-p-${slot}:`)
      }
    }
  })

  it('every theme declares color-scheme', () => {
    for (const file of themeFiles()) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      expect(css, `${file} is missing color-scheme`).toMatch(/color-scheme:\s*(light|dark)/)
    }
  })

  it('every theme defines only palette tokens, never semantic ones', () => {
    // 主題若覆寫 semantic 層，等於繞過兩層架構，元件的行為會依主題而異
    for (const file of themeFiles()) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      const declared = [...css.matchAll(/--bi-([a-z0-9-]+):/g)].map((m) => m[1]!)
      const nonPalette = declared.filter((n) => !n.startsWith('p-'))
      expect(nonPalette, `${file} declares semantic tokens: ${nonPalette.join(', ')}`).toEqual([])
    }
  })

  /**
   * 沒有 data-theme 的頁面必須仍然拿得到一份完整的 palette，否則所有語意
   * token 解析成空值、整個畫面失去樣式。這條降級路徑是真的會走到的：
   * index.html 的 inline script 在無痕模式下讀 localStorage 會拋錯，
   * 它的 catch 什麼都不做，正是因為 :root 已經是預設主題。
   */
  it('exactly one theme doubles as the :root default', () => {
    const defaults = themeFiles().filter((file) => {
      // 先去掉註解，否則說明文字裡提到 :root 也會被算進來
      const css = readFileSync(join(THEME_DIR, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      return /:root\s*[,{]/.test(css)
    })
    expect(defaults, `expected one :root default, found: ${defaults.join(', ') || 'none'}`)
      .toHaveLength(1)
  })
})
