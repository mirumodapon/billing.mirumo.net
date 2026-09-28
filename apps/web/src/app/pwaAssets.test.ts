import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/** PNG 的寬高在 IHDR：第 16–23 個位元組 */
function pngSize(path: string): [number, number] {
  const bytes = readFileSync(join(root, path))
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

describe('app icons (task#88)', () => {
  // Android 要有 192 與 512 的 PNG 才能安裝；maskable 版給會套遮罩的桌面
  it('lists 192, 512 and maskable icons in the manifest, and ships them at those sizes', () => {
    const config = read('vite.config.ts')
    for (const [file, size] of [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
    ] as const) {
      expect(config).toContain(`src: '${file}'`)
      expect(existsSync(join(root, 'public', file))).toBe(true)
      expect(pngSize(`public/${file}`)).toEqual([size, size])
    }
    expect(config).toMatch(/purpose: 'maskable'/)
  })

  it('gives the page a favicon and an iOS home-screen icon', () => {
    const html = read('index.html')
    expect(html).toContain('href="/favicon.svg"')
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"')
    expect(pngSize('public/apple-touch-icon.png')).toEqual([180, 180])
  })
})
