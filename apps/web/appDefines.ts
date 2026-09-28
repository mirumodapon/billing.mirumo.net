import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** 建置時的 commit（短 hash）。拿不到（沒有 git、不是 repo）就寫 dev，建置不能因此失敗 */
function commitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'
  } catch {
    return 'dev'
  }
}

/**
 * 設定頁「關於」顯示的版本與 commit（Plan 10 Task 7；task#132 起由建置日期改成 commit），
 * 建置時寫死進 bundle。vite.config 與 vitest.config 共用，測試裡看到的值與正式版同一個來源。
 */
export function appDefines(): Record<string, string> {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
  return {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commitHash()),
  }
}
