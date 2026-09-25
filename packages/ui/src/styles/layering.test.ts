import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 兩層 token 的架構只有在「元件永遠不碰 palette」這條規則沒有例外時才成立。
 * 一旦有例外，它就從可機械檢查的規則退化成靠自律的慣例，而主題也失去了
 * 重新映射的餘地——淺色主題可能需要換一組對比足夠的身分色。
 *
 * 所以這條規則由測試守，不是由註解守。
 */

const SRC = join(import.meta.dirname, '..')

/**
 * palette 層的合法歸屬——也就是「顏色可以是字面值」的地方。
 *
 * 這不是為了讓某些檔案免受檢查，而是因為它們本身**就是** palette：
 *   - styles/tokens.css   定義 semantic 層，所以必須引用 palette
 *   - styles/themes/      每個主題的原料
 *   - theme/palettes.ts   Tokyo Night 的原料，只是用 TS 而非 CSS 表達
 *                         （沒有 npm 調色盤套件，值只能 committed 在這裡）
 *
 * 刻意逐檔具名而不是豁免整個 theme/：mapping.ts 是邏輯，它不該出現任何色值。
 */
const PALETTE_SOURCES = ['styles/tokens.css', 'styles/themes/', 'theme/palettes.ts']

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, acc)
    else acc.push(path)
  }
  return acc
}

function componentSources(): string[] {
  return walk(SRC)
    .filter((p) => /\.(tsx?|css)$/.test(p))
    .filter((p) => !p.endsWith('.test.ts') && !p.endsWith('.test.tsx'))
    .filter((p) => {
      const rel = p.slice(SRC.length + 1)
      return !PALETTE_SOURCES.some((owner) => rel.startsWith(owner))
    })
}

describe('token layering', () => {
  it('no component source reaches into the palette layer', () => {
    const offenders: string[] = []
    for (const path of componentSources()) {
      const text = readFileSync(path, 'utf8')
      // 註解裡提到 --bi-p-* 是可以的；實際引用不行
      const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      if (stripped.includes('--bi-p-')) offenders.push(path.slice(SRC.length + 1))
    }
    expect(offenders, `these reference palette tokens directly: ${offenders.join(', ')}`).toEqual([])
  })

  it('no component source hardcodes a hex colour', () => {
    const offenders: string[] = []
    for (const path of componentSources()) {
      const stripped = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      if (/#[0-9a-fA-F]{3,8}\b/.test(stripped)) offenders.push(path.slice(SRC.length + 1))
    }
    expect(offenders, `these hardcode a colour: ${offenders.join(', ')}`).toEqual([])
  })

  it('exposes one semantic identity colour per AccentKey slot', () => {
    // core 的 AccentKey 是 accent1..accent12，元件用 var(--bi-${colorKey}) 直接代入。
    // 少一個，那個槽位的成員頭像就會沒有顏色。
    const tokens = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8')
    for (let i = 1; i <= 12; i += 1) {
      expect(tokens, `missing semantic --bi-accent${i}`).toContain(`--bi-accent${i}:`)
    }
  })
})
