import type { TokyoNightPalette } from './palettes'

export const PALETTE_SLOTS = [
  'bg', 'bg-sunken', 'bg-deepest',
  'surface1', 'surface2', 'surface3',
  'text', 'text-muted', 'text-subtle',
  // 陰影與遮罩共用這一個來源。存成空格分隔的 RGB 通道，讓 semantic 層
  // 用同一個底色配出 raised / sheet / dialog / scrim 四種透明度。
  //
  // 遮罩與陰影本來分成兩個槽位，但壓黑之後八個主題都收斂到近黑，色相差異
  // 幾乎看不出來——兩個永遠相同的槽位只是多一個會不同步的地方。
  'shadow-rgb',
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
    'shadow-rgb': toRgbChannels(darken(c('crust'), SHADOW_DARKEN)),
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

/**
 * '#11111b' → '17 17 27'
 *
 * 存通道而不存完整顏色，是為了讓 semantic 層用同一個底色配不同透明度
 * （raised 用 0.18、sheet 用 0.3、dialog 用 0.4），而不必逐個主題列出四種。
 */
/**
 * 兩個主題家族共用的壓黑幅度。實測過 0 / 0.4 / 0.7 / 0.85 四個值，
 * 0.85 是淺色主題第一個達到「看得出來背景被壓下去」的點。
 */
const SHADOW_DARKEN = 0.85

/**
 * 把顏色往黑壓 `amount`（0–1）。
 *
 * 遮罩不能直接用主題最深的底色。深色主題的最深色本來就接近黑，沒問題；
 * 淺色主題的「最深」仍然是淺的——Catppuccin Latte 的 crust 是 #dce0e8，
 * 疊 56% 上去只讓背景暗了 1.09 倍，等於完全沒有調暗，而遮罩存在的唯一
 * 理由就是讓背景後退。
 *
 * 壓 85% 之後淺色主題變成 3.6 倍（純黑是 4.8 倍），深色主題 1.13–1.41 倍，
 * 與純黑的 1.18 倍同級。深色主題本來就無法靠遮罩分層——背景已經接近黑了，
 * 那是 --bi-shadow-sheet 的工作。
 */
export function darken(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const channels = [0, 2, 4]
    .map((i) => Math.round(Number.parseInt(full.slice(i, i + 2), 16) * (1 - amount)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
  return `#${channels}`
}

export function toRgbChannels(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16))
  return `${r} ${g} ${b}`
}

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
    'shadow-rgb': toRgbChannels(darken(p.black, SHADOW_DARKEN)),
  }
}
