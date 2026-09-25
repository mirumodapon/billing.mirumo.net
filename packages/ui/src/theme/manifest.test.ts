import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { THEMES } from './manifest'
import { applyTheme, resolveSystemTheme } from './applyTheme'

describe('THEMES', () => {
  it('has one entry per generated theme file', () => {
    const files = readdirSync(join(import.meta.dirname, '../styles/themes'))
      .filter((f) => f.endsWith('.css') && f !== 'index.css')
      .map((f) => f.replace('.css', ''))
      .sort()
    expect(THEMES.map((t) => t.id).sort()).toEqual(files)
  })

  it('pairs every theme with one of the opposite scheme in the same family', () => {
    for (const theme of THEMES) {
      const paired = THEMES.find((t) => t.id === theme.pairedWith)
      expect(paired, `${theme.id} pairs with a theme that does not exist`).toBeDefined()
      expect(paired!.family).toBe(theme.family)
      expect(paired!.scheme).not.toBe(theme.scheme)
    }
  })

  it('gives every family exactly one light theme to fall back to', () => {
    const families = [...new Set(THEMES.map((t) => t.family))]
    for (const family of families) {
      const light = THEMES.filter((t) => t.family === family && t.scheme === 'light')
      expect(light, `${family} needs exactly one light theme`).toHaveLength(1)
    }
  })
})

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('stamps the id onto the root element', () => {
    expect(applyTheme('tokyo-night')).toBe('tokyo-night')
    expect(document.documentElement.dataset.theme).toBe('tokyo-night')
  })

  it('resolves system to the family pair matching the OS preference', () => {
    // jsdom 的 matchMedia 預設回報 matches: false，也就是淺色
    const resolved = resolveSystemTheme('catppuccin')
    expect(resolved).toBe('catppuccin-latte')
  })

  it('never leaves the root without a theme', () => {
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBeTruthy()
  })
})
