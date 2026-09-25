import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { flavors } from '@catppuccin/palette'
// 相對 import 必須帶 .ts：Node 24 原生執行 TypeScript，但不會替你補副檔名
import { catppuccinToSlots, tokyoNightToSlots } from '../src/theme/mapping.ts'
import { TOKYO_NIGHT } from '../src/theme/palettes.ts'

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
    slots: catppuccinToSlots(flavors[f]),
  })),
  ...(['day', 'night', 'storm', 'moon'] as const).map((v) => ({
    id: v === 'night' ? 'tokyo-night' : `tokyo-night-${v}`,
    label: v === 'night' ? 'Tokyo Night' : `Tokyo Night ${v[0]!.toUpperCase()}${v.slice(1)}`,
    scheme: TOKYO_SCHEMES[v],
    source: 'https://github.com/folke/tokyonight.nvim （MIT）',
    slots: tokyoNightToSlots(TOKYO_NIGHT[v]),
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
