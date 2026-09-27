import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { flavors } from '@catppuccin/palette'
// 相對 import 必須帶 .ts：Node 24 原生執行 TypeScript，但不會替你補副檔名
import { catppuccinToSlots, tokyoNightToSlots } from '../src/theme/mapping.ts'
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

const OUT = join(import.meta.dirname, '../src/styles/themes')

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
    slots: withAccentForegrounds(catppuccinToSlots(flavors[f])),
  })),
  ...(['day', 'night', 'storm', 'moon'] as const).map((v) => ({
    id: v === 'night' ? 'tokyo-night' : `tokyo-night-${v}`,
    label: v === 'night' ? 'Tokyo Night' : `Tokyo Night ${v[0]!.toUpperCase()}${v.slice(1)}`,
    scheme: TOKYO_SCHEMES[v],
    source: 'https://github.com/folke/tokyonight.nvim （MIT）',
    slots: withAccentForegrounds(tokyoNightToSlots(TOKYO_NIGHT[v])),
  })),
]

/** 沒設 data-theme 時的預設主題 */
const DEFAULT_ID = 'catppuccin-mocha'

mkdirSync(OUT, { recursive: true })

for (const spec of specs) {
  const selector = spec.id === DEFAULT_ID ? `:root,\n[data-theme='${spec.id}']` : `[data-theme='${spec.id}']`
  const body = Object.entries(spec.slots)
    .map(([slot, hex]) => `  --bi-p-${slot}: ${hex};`)
    .join('\n')

  writeFileSync(
    join(OUT, `${spec.id}.css`),
    `/*\n * ${spec.label} — ${spec.source}\n * 由 scripts/generate-themes.ts 產生，不要手改。\n */\n${selector} {\n  color-scheme: ${spec.scheme};\n\n${body}\n}\n`,
  )
}

writeFileSync(
  join(OUT, 'index.css'),
  `/* 由 scripts/generate-themes.ts 產生，不要手改。 */\n${specs
    .map((s) => `@import './${s.id}.css';`)
    .join('\n')}\n`,
)

console.log(`generated ${specs.length} themes`)
