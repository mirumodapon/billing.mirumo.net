import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { flavors } from '@catppuccin/palette'
// 相對 import 必須帶 .ts：Node 24 原生執行 TypeScript，但不會替你補副檔名
import { catppuccinToSlots, darken, tokyoNightToSlots } from '../src/theme/mapping.ts'
import { contrast } from '../src/theme/colorScience.ts'
import { INK, TOKYO_NIGHT } from '../src/theme/palettes.ts'

/** 填色上的字至少要有這個對比（WCAG AA 一般文字） */
const FILL_TEXT_CONTRAST = 4.5

/**
 * 替每個 accent 挑它填色上的字色（task#71）。
 *
 * 主題最深的底色夠用就用它：深色主題的 accent 是淺色粉彩，配深色字剛好，
 * 而且保留主題自己的色調。不夠時——淺色主題的 accent 是中等亮度的飽和色，
 * 配同樣偏淺的「最深底色」幾乎看不見——在純黑與純白之間挑對比較高的那個。
 *
 * 單一前景色救不了淺色主題：Latte 配白最差 2.62、配黑最差 3.87。每格各自挑
 * 之後兩個淺色主題 12 格全部 ≥ 4.5，而且 accent 本身不動。另一個方案「把填色
 * 調暗」也修得好對比，卻讓 Latte 的 12 色兩兩最小色差從 5.1 掉到 1.9，
 * 把 task#81 弄得更糟。
 */
function withAccentForegrounds(slots: Record<string, string>): Record<string, string> {
  const out = { ...slots }
  const deepest = slots['bg-deepest']!
  for (let n = 1; n <= 12; n += 1) {
    const fill = slots[`accent${n}`]!
    out[`accent${n}-fg`] =
      contrast(fill, deepest) >= FILL_TEXT_CONTRAST
        ? deepest
        : contrast(fill, INK.black) >= contrast(fill, INK.white)
          ? INK.black
          : INK.white
  }
  return out
}

/** 內文對主背景的對比（WCAG AAA），以及對下沉底與第一層表面的底線（AA） */
const BODY_TEXT_CONTRAST = { bg: 7, 'bg-sunken': 4.5, surface1: 4.5 }

/**
 * 內文色不夠清楚時，沿原色相往黑壓，直到每個底都達標（task#82）。
 *
 * Tokyo Night Day 的 fg 對 bg 只有 4.52，剛好壓線：任何疊在字底下的淡色
 * （選中的淡底、hover）都會讓它掉到 AA 以下。調色盤裡沒有更深的文字色可換，
 * 所以壓暗 fg 本身，藍色調留著。其他七個主題本來就達標，一個值都不動。
 *
 * 放在產生器而不是 mapping.ts：mapping.ts 一旦有值的 import，Node 原生跑
 * TypeScript 時就找不到模組（相對路徑沒有 .ts 副檔名）。
 */
function withReadableText(slots: Record<string, string>): Record<string, string> {
  const reads = (text: string) =>
    Object.entries(BODY_TEXT_CONTRAST).every(([slot, floor]) => contrast(text, slots[slot]!) >= floor)
  for (let step = 0; step <= 100; step += 1) {
    const text = darken(slots.text!, step / 100)
    if (reads(text)) return { ...slots, text }
  }
  // 往黑壓只救得了淺色主題；深色主題若不達標，要換成往白提亮，那時再寫
  throw new Error(`text ${slots.text} cannot reach ${JSON.stringify(BODY_TEXT_CONTRAST)} by darkening`)
}

const OUT =join(import.meta.dirname, '../src/styles/themes')

interface ThemeSpec {
  id: string
  label: string
  scheme: 'light' | 'dark'
  source: string
  slots: Record<string, string>
}

const TOKYO_SCHEMES = { day: 'light', night: 'dark', storm: 'dark', moon: 'dark' } as const

const specs: ThemeSpec[] = [
  // Catppuccin 的 flavour 自己帶 dark 旗標，不必另外硬編碼一張明暗表
  ...(['latte', 'frappe', 'macchiato', 'mocha'] as const).map((f) => ({
    id: `catppuccin-${f}`,
    label: `Catppuccin ${f[0]!.toUpperCase()}${f.slice(1)}`,
    scheme: (flavors[f].dark ? 'dark' : 'light') as 'light' | 'dark',
    source: 'https://catppuccin.com/ （MIT）',
    slots: withAccentForegrounds(withReadableText(catppuccinToSlots(flavors[f]))),
  })),
  ...(['day', 'night', 'storm', 'moon'] as const).map((v) => ({
    id: v === 'night' ? 'tokyo-night' : `tokyo-night-${v}`,
    label: v === 'night' ? 'Tokyo Night' : `Tokyo Night ${v[0]!.toUpperCase()}${v.slice(1)}`,
    scheme: TOKYO_SCHEMES[v],
    source: 'https://github.com/folke/tokyonight.nvim （MIT）',
    slots: withAccentForegrounds(withReadableText(tokyoNightToSlots(TOKYO_NIGHT[v]))),
  })),
]

/** 沒設 data-theme 時的預設主題 */
const DEFAULT_ID = 'catppuccin-mocha'

mkdirSync(OUT, { recursive: true })

const cssBody = (spec: ThemeSpec) =>
  Object.entries(spec.slots)
    .map(([slot, hex]) => `  --bi-p-${slot}: ${hex};`)
    .join('\n')

const header = (text: string) => `/*\n * ${text}\n * 由 scripts/generate-themes.ts 產生，不要手改。\n */\n`

for (const spec of specs) {
  /*
   * 主題選擇器寫成 :root[data-theme='…']（特異度 0,2,0），而不是單純的
   * [data-theme='…']（0,1,0），好贏過 default.css 的 :root（0,1,0）。
   *
   * 當初的 bug（task#80）：預設主題寫成 `:root, [data-theme='catppuccin-mocha']`，
   * 兩者同分時由匯入順序決定，而 Mocha 排在 Latte、Frappé、Macchiato 之後——
   * 那三個主題在 Storybook 與正式 app 裡永遠套不上。已在 headless Chromium 重現。
   */
  writeFileSync(
    join(OUT, `${spec.id}.css`),
    `${header(`${spec.label} — ${spec.source}`)}:root[data-theme='${spec.id}'] {\n  color-scheme: ${spec.scheme};\n\n${cssBody(spec)}\n}\n`,
  )
}

/*
 * 沒設 data-theme 時的預設主題，獨立成一個檔、在 index.css 第一個匯入。
 *
 * 特異度已經讓任何明確主題贏過它；再把它排在最前面是第二道保險：jsdom 對
 * 自訂屬性的層疊只看來源順序、不看特異度，排在最前面，測試套件才驗證得了
 * 「每個主題都套得上」這件事。
 */
const defaultSpec = specs.find((s) => s.id === DEFAULT_ID)!
writeFileSync(
  join(OUT, 'default.css'),
  `${header(`預設主題（${defaultSpec.label}），供沒有 data-theme 的頁面使用`)}:root {\n  color-scheme: ${defaultSpec.scheme};\n\n${cssBody(defaultSpec)}\n}\n`,
)

writeFileSync(
  join(OUT, 'index.css'),
  `/* 由 scripts/generate-themes.ts 產生，不要手改。default.css 必須排第一。 */\n@import './default.css';\n${specs
    .map((s) => `@import './${s.id}.css';`)
    .join('\n')}\n`,
)

console.log(`generated ${specs.length} themes`)
