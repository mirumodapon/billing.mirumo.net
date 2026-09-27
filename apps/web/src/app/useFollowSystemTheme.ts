import { useEffect } from 'react'
import { useSettings } from '../stores/StoresProvider'
import { persistTheme } from '../theme/persistTheme'

/**
 * 主題設為「跟隨系統」時，系統明暗一變就重新套用。
 * 掛在 Boot（整個 app 都在）而不是設定頁：使用者多半不在設定頁時，系統才在傍晚切成深色。
 */
export function useFollowSystemTheme(): void {
  const theme = useSettings((s) => s.settings.theme)
  const family = useSettings((s) => s.settings.themeFamily)
  useEffect(() => {
    if (theme !== 'system' || typeof globalThis.matchMedia !== 'function') return
    const query = globalThis.matchMedia('(prefers-color-scheme: dark)')
    const reapply = () => persistTheme('system', family)
    query.addEventListener('change', reapply)
    return () => query.removeEventListener('change', reapply)
  }, [theme, family])
}
