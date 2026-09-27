import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACCENT_ORDER, pickAccent } from './accentOrder'
import { deltaE } from './colorScience'

const THEME_DIR = join(import.meta.dirname, '../styles/themes')

/** 八個主題各自的 12 個 accent，依槽位編號排 */
function themeAccents(): string[][] {
  return readdirSync(THEME_DIR)
    .filter((f) => f.endsWith('.css') && f !== 'index.css' && f !== 'default.css')
    .map((f) => {
      const css = readFileSync(join(THEME_DIR, f), 'utf8')
      return Array.from({ length: 12 }, (_, i) => css.match(new RegExp(`--bi-p-accent${i + 1}:\\s*(#[0-9a-fA-F]{6});`))![1]!)
    })
}

const slot = (i: number) => `accent${i + 1}`

/** 兩格在八個主題裡最差的色差 */
function worstDelta(themes: string[][], i: number, j: number): number {
  return Math.min(...themes.map((accents) => deltaE(accents[i]!, accents[j]!)))
}

/** 與 accentOrder.ts 描述的同一個貪婪演算法 */
function greedyOrder(themes: string[][]): string[] {
  const n = 12
  let start = 0
  let bestMin = -1
  for (let i = 0; i < n; i += 1) {
    let m = Infinity
    for (let j = 0; j < n; j += 1) if (j !== i) m = Math.min(m, worstDelta(themes, i, j))
    if (m > bestMin) {
      bestMin = m
      start = i
    }
  }
  const order = [start]
  while (order.length < n) {
    let pick = -1
    let score = -1
    for (let i = 0; i < n; i += 1) {
      if (order.includes(i)) continue
      const s = Math.min(...order.map((j) => worstDelta(themes, i, j)))
      if (s > score) {
        score = s
        pick = i
      }
    }
    order.push(pick)
  }
  return order.map(slot)
}

/** 前 k 個之間最小的兩兩色差 */
function prefixMin(themes: string[][], order: readonly string[], k: number): number {
  const idx = order.slice(0, k).map((s) => Number(s.replace('accent', '')) - 1)
  let m = Infinity
  for (let a = 0; a < idx.length; a += 1) for (let b = a + 1; b < idx.length; b += 1) m = Math.min(m, worstDelta(themes, idx[a]!, idx[b]!))
  return m
}

describe('ACCENT_ORDER', () => {
  it('covers each of the twelve slots exactly once', () => {
    expect([...ACCENT_ORDER].sort()).toEqual(Array.from({ length: 12 }, (_, i) => slot(i)).sort())
  })

  /*
   * 常數是從色票算出來的。有人改了主題色票或映射而沒重算，這個順序就不再是
   * 最佳的——畫面上什麼都不會壞，只是某兩位成員又開始撞色。
   */
  it('is still the greedy best order for the current theme palettes', () => {
    expect([...ACCENT_ORDER]).toEqual(greedyOrder(themeAccents()))
  })

  // 規格原本的「依序指派」是這條要打敗的基準
  it('keeps every group at least as distinguishable as sequential assignment', () => {
    const themes = themeAccents()
    const sequential = Array.from({ length: 12 }, (_, i) => slot(i))
    for (let k = 2; k <= 12; k += 1) {
      expect(prefixMin(themes, ACCENT_ORDER, k), `group of ${k}`).toBeGreaterThanOrEqual(prefixMin(themes, sequential, k) - 1e-9)
    }
  })
})

describe('pickAccent', () => {
  it('starts at the top of the order', () => {
    expect(pickAccent([])).toBe('accent4')
  })

  it('takes the first slot nobody has', () => {
    expect(pickAccent(['accent4', 'accent10'])).toBe('accent7')
    // 用過的順序不影響結果：跳過的是槽位，不是位置
    expect(pickAccent(['accent7', 'accent4'])).toBe('accent10')
  })

  it('ignores slots outside the order', () => {
    expect(pickAccent(['not-a-slot'])).toBe('accent4')
  })

  /*
   * 十二格都用完後不從頭循環：第 13 位若直接拿 accent4，會與第一位撞色，
   * 即使那時有別的顏色才被用過一次。
   */
  it('reuses the least-used slot once all twelve are taken', () => {
    const allOnce = [...ACCENT_ORDER]
    expect(pickAccent(allOnce)).toBe('accent4')
    expect(pickAccent([...allOnce, 'accent4'])).toBe('accent10')
    expect(pickAccent([...allOnce, 'accent4', 'accent10', 'accent7'])).toBe('accent3')
  })
})
