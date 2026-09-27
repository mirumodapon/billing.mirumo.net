import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast } from './colorScience'

const THEME_DIR = join(import.meta.dirname, '../styles/themes')

/** palette 層的 34 個槽位。少一個，該主題就會沿用上一個主題的殘留值。 */
const PALETTE_SLOTS = [
  'bg', 'bg-sunken', 'bg-deepest',
  'surface1', 'surface2', 'surface3',
  'text', 'text-muted', 'text-subtle',
  // 陰影與遮罩共用這一個來源，存成空格分隔的 RGB 通道，
  // 讓 semantic 層用同一個底色配出 raised / sheet / dialog / scrim 四種透明度。
  'shadow-rgb',
  ...Array.from({ length: 12 }, (_, i) => `accent${i + 1}`),
  // 每個 accent 填色上的字色（task#71）
  ...Array.from({ length: 12 }, (_, i) => `accent${i + 1}-fg`),
]

function themeFiles(): string[] {
  // index.css 是 @import 聚合檔、default.css 是沒設 data-theme 時的預設值，
  // 兩者都不是一個可選的主題，混進來會讓清單多出兩個「主題」。
  return readdirSync(THEME_DIR).filter((f) => f.endsWith('.css') && f !== 'index.css' && f !== 'default.css')
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
    const imported = [...index.matchAll(/@import\s+'\.\/(.+?)\.css'/g)].map((m) => m[1]!)
    expect(imported.filter((id) => id !== 'default').sort()).toEqual(themeFiles().map((f) => f.replace('.css', '')).sort())
    // 預設值必須排第一：jsdom 只看來源順序，排在後面的話它會蓋掉前面的主題
    expect(imported[0]).toBe('default')
  })

  it('every theme defines all 34 palette slots', () => {
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
  it('provides the default in default.css and nowhere else', () => {
    const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(strip(readFileSync(join(THEME_DIR, 'default.css'), 'utf8'))).toMatch(/^\s*:root\s*{/)
    // 主題檔若再掛一個裸 :root，就回到了當初的 bug：同分時由順序決定誰贏
    const bare = themeFiles().filter((f) => /(^|[\s,}]):root\s*[,{]/.test(strip(readFileSync(join(THEME_DIR, f), 'utf8'))))
    expect(bare, `these themes also claim :root: ${bare.join(', ')}`).toEqual([])
  })})

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

  /*
   * 上面那條釘的是絕對亮度，這條釘的是關係：疊上去之後一定要比原本的背景暗。
   *
   * 兩條都需要，缺一不可。只有關係式的話，淺色主題把遮罩設成中灰也會通過
   * （中灰確實比淺背景暗），而那正是當初出事的那一類值；只有絕對值的話，
   * 它是照現有八個主題量出來的常數，第九個主題若背景更暗就不再適用。
   *
   * 這條對深色主題近乎必然成立（背景已經接近黑，還要更暗很容易），所以它
   * 真正守的是「有人把遮罩調成比背景亮」這種方向性錯誤，不是調暗幅度夠不夠。
   */
  it('composites darker than the background it sits on', () => {
    const SCRIM_ALPHA = 0.56
    const files = themeFiles()
    expect(files.length, 'no theme files were found').toBeGreaterThan(0)

    for (const file of files) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      const shadow = css
        .match(/--bi-p-shadow-rgb:\s*([^;]+);/)![1]!
        .trim()
        .split(/\s+/)
        .map(Number) as [number, number, number]
      const bgHex = css.match(/--bi-p-bg:\s*#([0-9a-fA-F]{6})/)![1]!
      const bg = [0, 2, 4].map((i) => Number.parseInt(bgHex.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
      ]

      const composited = bg.map((c, i) =>
        Math.round(SCRIM_ALPHA * shadow[i]! + (1 - SCRIM_ALPHA) * c),
      ) as [number, number, number]

      const before = relativeLuminance(bg)
      const after = relativeLuminance(composited)
      expect(
        after,
        `${file}: the scrim makes the page lighter, not darker (${before.toFixed(4)} -> ${after.toFixed(4)})`,
      ).toBeLessThan(before)
    }
  })
})

describe('text on accent fills (task#71)', () => {
  const hex = (css: string, slot: string) => css.match(new RegExp(`--bi-p-${slot}:\\s*(#[0-9a-fA-F]{6});`))?.[1]

  /*
   * 這條是 task#71 本身：每個主題、每個 accent 槽位，填色上的字都要達 WCAG AA。
   * 原本所有填色共用主題最深色當字色，淺色主題最差只有 1.90:1——頭像的字、
   * 主要按鈕的字、選中的膠囊，在 Latte 與 Tokyo Night Day 下幾乎看不見。
   */
  it('makes the text on every accent fill readable in every theme', () => {
    const failures: string[] = []
    const files = themeFiles()
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      for (let n = 1; n <= 12; n += 1) {
        const fill = hex(css, `accent${n}`)
        const fg = hex(css, `accent${n}-fg`)
        if (!fill || !fg) {
          failures.push(`${file} accent${n}: missing fill or foreground`)
          continue
        }
        const ratio = contrast(fill, fg)
        if (ratio < 4.5) failures.push(`${file} accent${n}: ${fill} on ${fg} is ${ratio.toFixed(2)}`)
      }
    }
    expect(failures).toEqual([])
  })

  /*
   * 主題最深的底色夠用時要用它，而不是一律換成純黑：它帶著主題自己的色調，
   * 深色主題原本的樣子就是靠它。這條擋住「全部改成黑白」這種對比合格但
   * 讓八個深色主題都變了樣的做法。
   */
  it('keeps the theme’s own deepest colour wherever it is already readable', () => {
    for (const file of themeFiles()) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      const deepest = hex(css, 'bg-deepest')!
      for (let n = 1; n <= 12; n += 1) {
        const fill = hex(css, `accent${n}`)!
        if (contrast(fill, deepest) >= 4.5) {
          expect(hex(css, `accent${n}-fg`), `${file} accent${n}`).toBe(deepest)
        }
      }
    }
  })
})

describe('switching themes at runtime (task#80)', () => {
  /*
   * 這是真正的行為測試：把主題檔依 index.css 的順序載進文件，逐一在 <html> 設
   * data-theme，讀實際算出來的值——前面的測試只檢查檔案內容，看不到層疊結果。
   *
   * 當初的 bug：預設主題寫成 `:root, [data-theme='catppuccin-mocha']`。`:root` 與
   * `[data-theme='…']` 特異度相同，同分時後寫的贏，而 Mocha 排在 Latte、Frappé、
   * Macchiato 之後——這三個主題在 Storybook 與正式 app 裡都永遠套不上，
   * 使用者選 Latte 拿到的是 Mocha。已在 headless Chromium 裡重現確認。
   */
  it('applies every theme when its id is set on <html>, whatever the import order', () => {
    const index = readFileSync(join(THEME_DIR, 'index.css'), 'utf8')
    const files = [...index.matchAll(/@import\s+'\.\/(.+?)\.css'/g)].map((m) => m[1]!)
    const order = files.filter((id) => id !== 'default')
    expect(order.length).toBe(8)
    const style = document.createElement('style')
    style.textContent = files.map((id) => readFileSync(join(THEME_DIR, `${id}.css`), 'utf8')).join('\n')
    document.head.append(style)
    try {
      const wrong: string[] = []
      for (const id of order) {
        const declared = readFileSync(join(THEME_DIR, `${id}.css`), 'utf8').match(/--bi-p-bg:\s*(#[0-9a-fA-F]{6});/)![1]
        document.documentElement.dataset.theme = id
        const actual = getComputedStyle(document.documentElement).getPropertyValue('--bi-p-bg').trim()
        if (actual !== declared) wrong.push(`${id}: expected ${declared}, got ${actual}`)
      }
      expect(wrong).toEqual([])
    } finally {
      style.remove()
      delete document.documentElement.dataset.theme
    }
  })

  // 沒設 data-theme 時仍要有完整的預設主題（無痕模式下 inline script 會失敗）
  it('falls back to the default theme when no theme is set', () => {
    const style = document.createElement('style')
    style.textContent = ['default.css', ...themeFiles()].map((f) => readFileSync(join(THEME_DIR, f), 'utf8')).join('\n')
    document.head.append(style)
    try {
      delete document.documentElement.dataset.theme
      const mocha = readFileSync(join(THEME_DIR, 'catppuccin-mocha.css'), 'utf8').match(/--bi-p-bg:\s*(#[0-9a-fA-F]{6});/)![1]
      expect(getComputedStyle(document.documentElement).getPropertyValue('--bi-p-bg').trim()).toBe(mocha)
    } finally {
      style.remove()
    }
  })
})
