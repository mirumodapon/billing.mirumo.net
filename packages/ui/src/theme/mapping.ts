import type { TokyoNightPalette } from './palettes'

export const PALETTE_SLOTS = [
  'bg', 'bg-sunken', 'bg-deepest',
  'surface1', 'surface2', 'surface3',
  'text', 'text-muted', 'text-subtle',
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
  'accent7', 'accent8', 'accent9', 'accent10', 'accent11', 'accent12',
] as const

export type PaletteSlot = (typeof PALETTE_SLOTS)[number]

/** @catppuccin/palette 的 flavour 形狀，只取我們用得到的部分 */
interface CatppuccinFlavour {
  colors: Record<string, { hex: string }>
}

/**
 * Catppuccin 的 14 個具名 accent 取 12 個，順序繞色相環一圈，
 * 讓相鄰的成員拿到明顯不同的顏色。
 */
const CATPPUCCIN_ACCENTS = [
  'red', 'peach', 'yellow', 'green', 'teal', 'sky',
  'sapphire', 'blue', 'lavender', 'mauve', 'maroon', 'pink',
] as const

export function catppuccinToSlots(flavour: CatppuccinFlavour): Record<PaletteSlot, string> {
  const c = (name: string): string => {
    const value = flavour.colors[name]
    if (!value) throw new Error(`catppuccinToSlots: missing colour ${name}`)
    return value.hex
  }
  const accents = Object.fromEntries(
    CATPPUCCIN_ACCENTS.map((name, i) => [`accent${i + 1}`, c(name)]),
  ) as Record<PaletteSlot, string>

  return {
    ...accents,
    bg: c('base'),
    'bg-sunken': c('mantle'),
    'bg-deepest': c('crust'),
    surface1: c('surface0'),
    surface2: c('surface1'),
    surface3: c('surface2'),
    text: c('text'),
    'text-muted': c('subtext1'),
    'text-subtle': c('subtext0'),
  }
}

/**
 * Tokyo Night 只有 9 個具名 accent，但 core 的 AccentKey 是 12 個槽位。
 * 缺的三個由既有色相混色補足，而不是重複既有顏色——重複會讓兩個成員
 * 拿到同一個色，使用者無從分辨。混色是決定性的，同樣的輸入永遠得到同樣的輸出。
 */
const TOKYO_NIGHT_ACCENTS: readonly (keyof TokyoNightPalette | [keyof TokyoNightPalette, keyof TokyoNightPalette])[] = [
  'red', 'orange', 'yellow', 'green', 'teal', 'cyan',
  'blue', 'purple', 'magenta',
  ['red', 'orange'], ['green', 'cyan'], ['blue', 'magenta'],
]

/** 兩色等比混合，回傳 #rrggbb */
export function mix(a: string, b: string): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  const [ar, ag, ab] = parse(a) as [number, number, number]
  const [br, bg, bb] = parse(b) as [number, number, number]
  const half = (x: number, y: number) => Math.round((x + y) / 2)
  return `#${[half(ar, br), half(ag, bg), half(ab, bb)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

export function tokyoNightToSlots(p: TokyoNightPalette): Record<PaletteSlot, string> {
  const accents = Object.fromEntries(
    TOKYO_NIGHT_ACCENTS.map((spec, i) => [
      `accent${i + 1}`,
      typeof spec === 'string' ? p[spec] : mix(p[spec[0]], p[spec[1]]),
    ]),
  ) as Record<PaletteSlot, string>

  return {
    ...accents,
    bg: p.bg,
    'bg-sunken': p.bg_dark,
    'bg-deepest': p.black,
    surface1: p.bg_highlight,
    surface2: p.fg_gutter,
    surface3: p.terminal_black,
    text: p.fg,
    'text-muted': p.fg_dark,
    'text-subtle': p.comment,
  }
}
