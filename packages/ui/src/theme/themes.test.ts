import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const THEME_DIR = join(import.meta.dirname, '../styles/themes')

/** palette 層的 23 個槽位。少一個，該主題就會沿用上一個主題的殘留值。 */
const PALETTE_SLOTS = [
  'bg', 'bg-sunken', 'bg-deepest',
  'surface1', 'surface2', 'surface3',
  'text', 'text-muted', 'text-subtle',
  // 陰影與遮罩逐主題不同：淺色主題的遮罩不該跟深色一樣黑。
  // 存成空格分隔的 RGB 通道，讓 semantic 層自己決定透明度。
  'shadow-rgb',
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

/** WCAG 的相對亮度。0 是黑、1 是白 */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

describe('scrim and shadow colour', () => {
  /*
   * 遮罩與陰影必須在每個主題下都是深色。
   *
   * 這條測試存在是因為第一版沒有它就出過事：當時直接取主題最深的底色，
   * 深色主題沒問題，但淺色主題的「最深」仍然是淺的——Catppuccin Latte 的
   * crust 是 #dce0e8，疊 56% 上去只讓背景暗了 1.09 倍，等於完全沒有調暗。
   * 全部測試照樣綠燈，因為當時的守衛只檢查 token 存在且引用了 palette。
   *
   * 門檻 0.06 是量出來的，不是猜的：
   *   目前八個主題最亮的是 latte 的 0.0159（近四倍餘裕）
   *   壓黑 0.7 會是 0.0561 —— 仍然通過，調校還有空間
   *   壓黑 0.4 會是 0.2382 —— 擋下
   *   完全不壓（當初的壞版本）是 0.7435 —— 擋下
   */
  const MAX_LUMINANCE = 0.06

  it('is dark in every theme, light themes included', () => {
    const files = themeFiles()
    // 一個檔案都沒讀到的話，下面的迴圈會零圈通過而什麼都沒證明
    expect(files.length, 'no theme files were found').toBeGreaterThan(0)

    for (const file of files) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      const raw = css.match(/--bi-p-shadow-rgb:\s*([^;]+);/)?.[1]
      expect(raw, `${file} has no --bi-p-shadow-rgb`).toBeDefined()

      const channels = raw!.trim().split(/\s+/).map(Number)
      expect(channels, `${file} does not store three channels`).toHaveLength(3)

      const luminance = relativeLuminance(channels as [number, number, number])
      expect(
        luminance,
        `${file} would not dim anything: --bi-p-shadow-rgb is ${raw!.trim()}, luminance ${luminance.toFixed(4)}`,
      ).toBeLessThan(MAX_LUMINANCE)
    }
  })
})
