import { DEFAULT_THEME, THEMES, type ThemeFamily, type ThemeId } from './manifest'

/**
 * 依系統的明暗偏好，在同一家族裡挑出該用的那一個。
 *
 * 每個家族只有一個淺色主題，深色則有好幾個：深色一律取淺色主題的配對
 * （pairedWith），不是家族裡排第一的深色主題。index.html 的開機 script
 * 做同樣的選擇，兩邊不一致的話冷啟動會先畫一個、設定載入後又換一個。
 */
export function resolveSystemTheme(family: ThemeFamily): ThemeId {
  const prefersDark =
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-color-scheme: dark)').matches
  const light = THEMES.find((t) => t.family === family && t.scheme === 'light')
  if (!light) return DEFAULT_THEME
  return prefersDark ? light.pairedWith : light.id
}

/**
 * 套用主題，回傳實際套上去的 id。
 *
 * 同時更新 `<meta name="theme-color">`，否則 iOS 與 Android 的狀態列
 * 會維持前一個主題的顏色——深色主題配淺色狀態列非常突兀，而這一點
 * 在只看網頁內容時完全不會發現。
 */
export function applyTheme(
  id: ThemeId | 'system',
  family: ThemeFamily = 'catppuccin',
  root: HTMLElement = document.documentElement,
): ThemeId {
  const resolved = id === 'system' ? resolveSystemTheme(family) : id
  root.dataset.theme = resolved

  // 讀 semantic 層而不是 palette 層。兩者在預設映射下解析出同一個顏色，但
  // 狀態列該跟隨「頁面背景」這個角色——哪天某個主題把 --bi-bg 指到別的槽位，
  // 狀態列也應該跟著改。順帶讓這個檔案完全不必提到 palette。
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) {
    meta.content = globalThis.getComputedStyle(root).getPropertyValue('--bi-bg').trim()
  }
  return resolved
}
