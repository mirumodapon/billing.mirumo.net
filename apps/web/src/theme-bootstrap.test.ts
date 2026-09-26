import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { THEMES } from '@billing/ui'
import { describe, expect, it } from 'vitest'

/*
 * index.html 的 inline script 刻意不 import 任何東西（多一個 module 請求就多一次
 * 閃爍的機會），代價是它硬寫的主題 id 與 manifest 之間沒有任何連結。改名之後它
 * 會設定一個不存在的主題，頁面退回 :root 預設——而那個退化正好就是這段 script
 * 存在要防的那記閃光，還是無聲的。
 *
 * 這條測試只證明 script 提到的 id 都還存在，不證明它挑對了主題。
 */
describe('index.html theme bootstrap', () => {
  it('names only themes that still exist', () => {
    const html = readFileSync(join(import.meta.dirname, '../index.html'), 'utf8')
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''
    expect(script, 'no inline script found in index.html').not.toBe('')

    const known = new Set(THEMES.map((t) => t.id))
    const named = [...script.matchAll(/'([a-z]+-[a-z-]+)'/g)]
      .map((m) => m[1]!)
      .filter((s) => s.includes('catppuccin') || s.includes('tokyo'))
    expect(named.length, 'the script names no theme ids at all').toBeGreaterThan(0)
    for (const id of named) {
      expect(known, `index.html names a theme that no longer exists: ${id}`).toContain(id)
    }
  })
})
