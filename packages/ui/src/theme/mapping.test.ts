import { flavors } from '@catppuccin/palette'
import { describe, expect, it } from 'vitest'
import { PALETTE_SLOTS, catppuccinToSlots, tokyoNightToSlots } from './mapping'
import { TOKYO_NIGHT } from './palettes'

const HEX = /^#[0-9a-f]{6}$/i
// shadow-rgb stores space-separated RGB channels (for rgb(... / alpha)
// in the semantic layer), not finished hex colours — everything else is still hex.
const RGB_CHANNELS = /^\d{1,3} \d{1,3} \d{1,3}$/
const formatFor = (slot: string) => (slot.endsWith('-rgb') ? RGB_CHANNELS : HEX)

describe('palette mapping', () => {
  it('maps every Catppuccin flavour onto all 23 slots', () => {
    for (const name of ['latte', 'frappe', 'macchiato', 'mocha'] as const) {
      const slots = catppuccinToSlots(flavors[name])
      expect(Object.keys(slots).sort()).toEqual([...PALETTE_SLOTS].sort())
      for (const [slot, value] of Object.entries(slots)) {
        expect(value, `${name}.${slot}`).toMatch(formatFor(slot))
      }
    }
  })

  it('maps every Tokyo Night variant onto all 23 slots', () => {
    for (const name of ['night', 'storm', 'moon', 'day'] as const) {
      const slots = tokyoNightToSlots(TOKYO_NIGHT[name])
      expect(Object.keys(slots).sort()).toEqual([...PALETTE_SLOTS].sort())
      for (const [slot, value] of Object.entries(slots)) {
        expect(value, `${name}.${slot}`).toMatch(formatFor(slot))
      }
    }
  })

  // Tokyo Night 只有 9 個具名 accent，補到 12 個時不能靜靜重複——
  // 兩個成員拿到同一個顏色，使用者會以為是同一個人
  it('gives Tokyo Night twelve distinct accents', () => {
    for (const name of ['night', 'storm', 'moon', 'day'] as const) {
      const slots = tokyoNightToSlots(TOKYO_NIGHT[name])
      const accents = PALETTE_SLOTS.filter((s) => s.startsWith('accent')).map((s) => slots[s])
      expect(new Set(accents).size, `${name} has duplicate accents`).toBe(12)
    }
  })

  it('keeps the background and text ramps ordered by luminance', () => {
    // bg → surface1 → surface2 → surface3 必須單調，否則層次感會反過來
    const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16)
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
    }
    for (const name of ['night', 'storm', 'moon', 'day'] as const) {
      const s = tokyoNightToSlots(TOKYO_NIGHT[name])
      const ramp = [s.bg, s.surface1, s.surface2, s.surface3].map(lum)
      const ascending = ramp.every((v, i) => i === 0 || v >= ramp[i - 1]!)
      const descending = ramp.every((v, i) => i === 0 || v <= ramp[i - 1]!)
      expect(ascending || descending, `${name} surface ramp is not monotonic`).toBe(true)
    }
  })
})
