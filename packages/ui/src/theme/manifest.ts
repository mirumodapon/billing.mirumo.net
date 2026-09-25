export type ThemeFamily = 'catppuccin' | 'tokyo-night'

export type ThemeId =
  | 'catppuccin-latte'
  | 'catppuccin-frappe'
  | 'catppuccin-macchiato'
  | 'catppuccin-mocha'
  | 'tokyo-night-day'
  | 'tokyo-night-storm'
  | 'tokyo-night-moon'
  | 'tokyo-night'

export interface ThemeManifest {
  id: ThemeId
  family: ThemeFamily
  /** 顯示名稱，專有名詞不進 i18n */
  label: string
  scheme: 'light' | 'dark'
  /** 「跟隨系統」時的另一半 */
  pairedWith: ThemeId
}

export const THEMES: readonly ThemeManifest[] = [
  { id: 'catppuccin-latte', family: 'catppuccin', label: 'Catppuccin Latte', scheme: 'light', pairedWith: 'catppuccin-mocha' },
  { id: 'catppuccin-frappe', family: 'catppuccin', label: 'Catppuccin Frappé', scheme: 'dark', pairedWith: 'catppuccin-latte' },
  { id: 'catppuccin-macchiato', family: 'catppuccin', label: 'Catppuccin Macchiato', scheme: 'dark', pairedWith: 'catppuccin-latte' },
  { id: 'catppuccin-mocha', family: 'catppuccin', label: 'Catppuccin Mocha', scheme: 'dark', pairedWith: 'catppuccin-latte' },
  { id: 'tokyo-night-day', family: 'tokyo-night', label: 'Tokyo Night Day', scheme: 'light', pairedWith: 'tokyo-night' },
  { id: 'tokyo-night-storm', family: 'tokyo-night', label: 'Tokyo Night Storm', scheme: 'dark', pairedWith: 'tokyo-night-day' },
  { id: 'tokyo-night-moon', family: 'tokyo-night', label: 'Tokyo Night Moon', scheme: 'dark', pairedWith: 'tokyo-night-day' },
  { id: 'tokyo-night', family: 'tokyo-night', label: 'Tokyo Night', scheme: 'dark', pairedWith: 'tokyo-night-day' },
] as const

export const DEFAULT_THEME: ThemeId = 'catppuccin-mocha'
