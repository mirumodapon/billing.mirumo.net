import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 從 `@media (prefers-reduced-motion: reduce)` 的左大括號開始數括號，數到配對的
 * 右大括號為止。
 *
 * 用正規表示式抓到 `\n}` 為止也能work，但那是靠「外層的收尾大括號剛好沒有縮排、
 * 內層的有」這個排版巧合。formatter 把區塊壓成一行、改成 CRLF、或哪天多包一層，
 * 它就會安靜地抓到空字串——而抓到空字串的時候，下面那條斷言會說「一個 token 都
 * 沒歸零」，看起來像真的壞掉，實際上是測試自己壞了。守衛測試會無故變紅的話，
 * 遲早會被人刪掉，保護也就跟著沒了。
 */
function reducedMotionBlock(css: string): string {
  const start = css.search(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/)
  if (start === -1) return ''
  const open = css.indexOf('{', start)
  if (open === -1) return ''
  let depth = 0
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  return ''
}

describe('reduced motion', () => {
  /*
   * 每個時長 token 都必須在 reduced-motion 區塊裡歸零。漏掉一個不會有任何
   * 東西報錯——只有設定了「減少動態」的使用者會看到它繼續動，而開發時
   * 幾乎不會有人切到那個設定去檢查。
   */
  it('zeroes every duration token under reduced motion', () => {
    const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')
    const block = reducedMotionBlock(css)
    // 抓不到區塊時要說是抓不到，不要讓它偽裝成「token 沒歸零」
    expect(block, 'could not locate the prefers-reduced-motion block in tokens.css').not.toBe('')

    const declared = [...css.matchAll(/--bi-(dur-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
    const zeroed = [...block.matchAll(/--bi-(dur-[a-z0-9-]+)\s*:\s*0m?s\b/g)].map((m) => m[1])
    expect([...new Set(declared)].sort()).toEqual([...new Set(zeroed)].sort())
  })

  /*
   * 上面那條的成敗完全取決於 reducedMotionBlock 有沒有抓對範圍，所以這裡直接
   * 釘住它：換行被壓掉、縮排改變、外面多包一層時都還要抓得到，而且不能把區塊
   * 外的東西一起吃進來。少了這條，抓取一旦壞掉只會表現成上面那條無故變紅。
   */
  it('finds the block regardless of how the file is formatted', () => {
    const inner = '--bi-dur-x: 0ms;'
    const shapes = [
      `:root { --bi-dur-x: 1s; }\n@media (prefers-reduced-motion: reduce) {\n  :root {\n    ${inner}\n  }\n}\n`,
      `@media (prefers-reduced-motion: reduce){:root{${inner}}}`,
      `@media  ( prefers-reduced-motion : reduce ) {\r\n\t:root {\r\n\t\t${inner}\r\n\t}\r\n}\r\n`,
      `@supports (color: red) {\n@media (prefers-reduced-motion: reduce) {\n  :root { ${inner} }\n}\n}\n`,
    ]
    for (const css of shapes) {
      expect(reducedMotionBlock(css), `failed on: ${JSON.stringify(css)}`).toContain(inner)
    }
    // 區塊外的宣告不能被吃進來，否則「歸零了」會被誤判成真
    expect(reducedMotionBlock(shapes[0]!)).not.toContain('1s')
    // 沒有這個區塊時回空字串，讓上面那條的斷言說出真正的原因
    expect(reducedMotionBlock(':root { --bi-dur-x: 1s; }')).toBe('')
  })
})

describe('overlay tokens', () => {
  /*
   * 這四個 token 是 Sheet / Dialog / Snackbar / Fab 共用的。少了任何一個，
   * 用到它的元件會拿到空值——陰影整個消失、遮罩變透明，而 CSS 不會報錯，
   * 只有肉眼看得出來。
   */
  it('defines every overlay token the layout components need', () => {
    const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')
    for (const name of ['scrim', 'shadow-raised', 'shadow-sheet', 'shadow-dialog']) {
      expect(css, `tokens.css is missing --bi-${name}`).toMatch(
        new RegExp(`--bi-${name}\\s*:`),
      )
    }
  })

  /*
   * 遮罩與陰影必須引用 palette 的通道值，不能寫死。寫死的話八個主題會共用
   * 同一個黑，而淺色主題的遮罩會過重——那正是把它放進 palette 層的理由。
   */
  it('derives the scrim and shadows from the theme palette', () => {
    const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')
    for (const name of ['scrim', 'shadow-raised', 'shadow-sheet', 'shadow-dialog']) {
      const decl = css.match(new RegExp(`--bi-${name}\\s*:([^;]+);`))?.[1] ?? ''
      expect(decl, `--bi-${name} does not reference the palette`).toMatch(/--bi-p-(shadow|scrim)-rgb/)
    }
  })

  it('exposes every safe-area edge', () => {
    const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      expect(css, `tokens.css is missing --bi-safe-${edge}`).toMatch(
        new RegExp(`--bi-safe-${edge}\\s*:\\s*env\\(safe-area-inset-${edge}`),
      )
    }
  })
})
