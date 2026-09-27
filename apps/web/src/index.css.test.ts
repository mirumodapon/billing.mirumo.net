import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * CSS 不進 jsdom，所以這裡只能證明「規則寫了」，不能證明瀏覽器照做。
 * 真正的效果在 Plan 6 Task 15 的 Chromium 走查裡看。
 */
const css = readFileSync(join(import.meta.dirname, 'index.css'), 'utf8')

describe('global stylesheet', () => {
  it('hides native scrollbars in both engines (spec 5.2, task#77)', () => {
    expect(css).toMatch(/\*\s*{\s*scrollbar-width:\s*none;?\s*}/)
    expect(css).toMatch(/\*::-webkit-scrollbar\s*{\s*display:\s*none;?\s*}/)
  })

  it('keeps the touch rules from spec 5.6', () => {
    expect(css).toMatch(/-webkit-tap-highlight-color:\s*transparent/)
    expect(css).toMatch(/overscroll-behavior:\s*none/)
    expect(css).toMatch(/input,\s*textarea,\s*\[data-selectable\]\s*{\s*user-select:\s*text/)
  })
})
