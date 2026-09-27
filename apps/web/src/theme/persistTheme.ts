import { applyTheme, type ThemeFamily, type ThemeId } from '@billing/ui'

/** index.html 的 inline script 讀這兩個 key，改名要兩邊一起改（persistTheme.test.ts 會檢查） */
export const THEME_KEY = 'bi-theme'
export const THEME_FAMILY_KEY = 'bi-theme-family'

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/**
 * 套用主題，並把選擇鏡像到 localStorage（Plan 6 D8）。
 *
 * inline script 在 React 之前同步讀這兩個 key 決定首次繪製的顏色，它碰不到
 * IndexedDB。存的是使用者的「選擇」（可能是 'system'），不是解析後的結果。
 */
export function persistTheme(theme: ThemeId | 'system', family: ThemeFamily, store = storage()): ThemeId {
  const applied = applyTheme(theme, family)
  try {
    store?.setItem(THEME_KEY, theme)
    store?.setItem(THEME_FAMILY_KEY, family)
  } catch {
    // 鏡像失敗只影響下次首次繪製的顏色；IndexedDB 裡的設定才是準
  }
  return applied
}
