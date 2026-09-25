import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const THEME_DIR = join(import.meta.dirname, '../styles/themes')

/** palette 層的 21 個槽位。少一個，該主題就會沿用上一個主題的殘留值。 */
const PALETTE_SLOTS = [
  'bg', 'bg-sunken', 'bg-deepest',
  'surface1', 'surface2', 'surface3',
  'text', 'text-muted', 'text-subtle',
  ...Array.from({ length: 12 }, (_, i) => `accent${i + 1}`),
]

function themeFiles(): string[] {
  return readdirSync(THEME_DIR).filter((f) => f.endsWith('.css'))
}

describe('theme files', () => {
  it('every theme defines all 21 palette slots', () => {
    for (const file of themeFiles()) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      for (const slot of PALETTE_SLOTS) {
        expect(css, `${file} is missing --bi-p-${slot}`).toContain(`--bi-p-${slot}:`)
      }
    }
  })

  it('every theme declares color-scheme', () => {
    for (const file of themeFiles()) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      expect(css, `${file} is missing color-scheme`).toMatch(/color-scheme:\s*(light|dark)/)
    }
  })

  it('every theme defines only palette tokens, never semantic ones', () => {
    // 主題若覆寫 semantic 層，等於繞過兩層架構，元件的行為會依主題而異
    for (const file of themeFiles()) {
      const css = readFileSync(join(THEME_DIR, file), 'utf8')
      const declared = [...css.matchAll(/--bi-([a-z0-9-]+):/g)].map((m) => m[1]!)
      const nonPalette = declared.filter((n) => !n.startsWith('p-'))
      expect(nonPalette, `${file} declares semantic tokens: ${nonPalette.join(', ')}`).toEqual([])
    }
  })
})
