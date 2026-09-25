import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('reduced motion', () => {
  /*
   * 每個時長 token 都必須在 reduced-motion 區塊裡歸零。漏掉一個不會有任何
   * 東西報錯——只有設定了「減少動態」的使用者會看到它繼續動，而開發時
   * 幾乎不會有人切到那個設定去檢查。
   */
  it('zeroes every duration token under reduced motion', () => {
    const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*{([\s\S]*?)\n}/)?.[1] ?? ''
    const declared = [...css.matchAll(/--bi-(dur-[a-z0-9-]+):/g)].map((m) => m[1])
    const zeroed = [...block.matchAll(/--bi-(dur-[a-z0-9-]+):\s*0ms/g)].map((m) => m[1])
    expect([...new Set(declared)].sort()).toEqual([...new Set(zeroed)].sort())
  })
})
