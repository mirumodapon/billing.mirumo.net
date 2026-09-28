import { readFileSync } from 'node:fs'

/**
 * 設定頁「關於」顯示的版本與建置日期（Plan 10 Task 7），建置時寫死進 bundle。
 * vite.config 與 vitest.config 共用，測試裡看到的值與正式版同一個來源。
 */
export function appDefines(): Record<string, string> {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
  return {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  }
}
