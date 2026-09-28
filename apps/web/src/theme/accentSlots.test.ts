import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AccentKey } from '@billing/core'
import { ACCENT_ORDER, type AccentSlot } from '@billing/ui'
import { describe, expect, it } from 'vitest'

/*
 * task#64：身分色的 12 個名字是跨套件的不變量——core 的 AccentKey（存進資料裡的 colorKey）、
 * ui 的 AccentSlot／ACCENT_ORDER（元件接受的值）、tokens.css 的 --bi-accentN（實際的顏色）。
 * web 同時依賴兩個套件，在這裡把三者釘在一起。
 */

// 型別層：兩邊任何一邊多一個或少一個名字，這兩行就編譯不過（pnpm typecheck 變紅）
const coreFitsUi: AccentSlot = '' as AccentKey
const uiFitsCore: AccentKey = '' as AccentSlot
void coreFitsUi
void uiFitsCore

describe('accent slots across packages (task#64)', () => {
  it('lists twelve distinct slots in the order the app assigns them', () => {
    expect(ACCENT_ORDER).toHaveLength(12)
    expect(new Set(ACCENT_ORDER).size).toBe(12)
  })

  it('has a colour token for every slot', () => {
    const tokens = readFileSync(join(import.meta.dirname, '../../../../packages/ui/src/styles/tokens.css'), 'utf8')
    for (const slot of ACCENT_ORDER) expect(tokens, slot).toMatch(new RegExp(`--bi-${slot}:`))
  })
})
