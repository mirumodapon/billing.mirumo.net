/**
 * Tokyo Night 的官方色值。
 *
 * 來源：https://github.com/folke/tokyonight.nvim（MIT）
 *   extras/lua/tokyonight_{night,storm,moon,day}.lua
 * 取得於 2026-09-25。沒有 npm 調色盤套件，所以值 committed 在這裡；
 * 要更新時請從上述檔案重新抄寫，不要憑印象改。
 */
export interface TokyoNightPalette {
  bg: string
  bg_dark: string
  black: string
  bg_highlight: string
  terminal_black: string
  fg_gutter: string
  fg: string
  fg_dark: string
  comment: string
  red: string
  orange: string
  yellow: string
  green: string
  teal: string
  cyan: string
  blue: string
  purple: string
  magenta: string
}

export type TokyoNightVariant = 'night' | 'storm' | 'moon' | 'day'

export const TOKYO_NIGHT: Record<TokyoNightVariant, TokyoNightPalette> = {
  night: {
    bg: '#1a1b26', bg_dark: '#16161e', black: '#15161e',
    bg_highlight: '#292e42', terminal_black: '#414868', fg_gutter: '#3b4261',
    fg: '#c0caf5', fg_dark: '#a9b1d6', comment: '#565f89',
    red: '#f7768e', orange: '#ff9e64', yellow: '#e0af68', green: '#9ece6a',
    teal: '#1abc9c', cyan: '#7dcfff', blue: '#7aa2f7', purple: '#9d7cd8',
    magenta: '#bb9af7',
  },
  storm: {
    bg: '#24283b', bg_dark: '#1f2335', black: '#1d202f',
    bg_highlight: '#292e42', terminal_black: '#414868', fg_gutter: '#3b4261',
    fg: '#c0caf5', fg_dark: '#a9b1d6', comment: '#565f89',
    red: '#f7768e', orange: '#ff9e64', yellow: '#e0af68', green: '#9ece6a',
    teal: '#1abc9c', cyan: '#7dcfff', blue: '#7aa2f7', purple: '#9d7cd8',
    magenta: '#bb9af7',
  },
  moon: {
    bg: '#222436', bg_dark: '#1e2030', black: '#1b1d2b',
    bg_highlight: '#2f334d', terminal_black: '#444a73', fg_gutter: '#3b4261',
    fg: '#c8d3f5', fg_dark: '#828bb8', comment: '#636da6',
    red: '#ff757f', orange: '#ff966c', yellow: '#ffc777', green: '#c3e88d',
    teal: '#4fd6be', cyan: '#86e1fc', blue: '#82aaff', purple: '#fca7ea',
    magenta: '#c099ff',
  },
  day: {
    bg: '#e1e2e7', bg_dark: '#d0d5e3', black: '#b4b5b9',
    bg_highlight: '#c4c8da', terminal_black: '#a1a6c5', fg_gutter: '#a8aecb',
    fg: '#3760bf', fg_dark: '#6172b0', comment: '#848cb5',
    red: '#f52a65', orange: '#b15c00', yellow: '#8c6c3e', green: '#587539',
    teal: '#118c74', cyan: '#007197', blue: '#2e7de9', purple: '#7847bd',
    magenta: '#9854f1',
  },
}

/**
 * 純黑與純白，給填色挑前景用（task#71）。放在這裡而不是 mapping.ts，
 * 是因為色值只屬於 palette 層——mapping.ts 是邏輯，layering 測試不准它出現色值。
 */
export const INK = { black: '#000000', white: '#ffffff' } as const
