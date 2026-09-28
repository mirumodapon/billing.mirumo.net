// 正式建置前確認 @billing/core 與 @billing/ui 的 dist 不比原始碼舊（task#78）。
//
// web 的正式建置透過 exports 的 default 條件讀這兩個套件的 dist（例如 ui 的 index.css）。
// 只跑 `pnpm --filter web build` 而沒先重建它們時，畫面會用舊的元件樣式，而且沒有任何錯誤。
// 這裡把那種情況變成建置失敗，並說明該怎麼做。從根目錄 `pnpm build` 會依相依順序先建好它們。
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../packages/', import.meta.url).pathname
const IGNORED = /\.(test|stories)\.[cm]?[jt]sx?$/

function newestSource(dir) {
  let newest = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) newest = Math.max(newest, newestSource(path))
    else if (!IGNORED.test(entry.name)) newest = Math.max(newest, statSync(path).mtimeMs)
  }
  return newest
}

const stale = []
for (const pkg of ['core', 'ui']) {
  const built = join(root, pkg, 'dist', 'index.js')
  if (!existsSync(built) || statSync(built).mtimeMs < newestSource(join(root, pkg, 'src'))) stale.push(`@billing/${pkg}`)
}

if (stale.length > 0) {
  console.error(`\n${stale.join(' and ')} ${stale.length > 1 ? 'are' : 'is'} not built or older than its source.`)
  console.error('Run `pnpm build` at the repository root so they are rebuilt before the app.\n')
  process.exit(1)
}
