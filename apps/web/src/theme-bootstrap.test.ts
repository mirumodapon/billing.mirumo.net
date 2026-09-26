import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { THEMES } from '@billing/ui'
import { describe, expect, it } from 'vitest'

/*
 * index.html 的 inline script 刻意不 import 任何東西（多一個 module 請求就多一次
 * 閃爍的機會），代價是它硬寫的主題 id 與 manifest 之間沒有任何連結。改名之後它
 * 會設定一個不存在的主題，頁面退回 :root 預設——而那個退化正好就是這段 script
 * 存在要防的那記閃光，還是無聲的。
 */

/** script 裡不是主題 id 的字串字面值。多出任何一個都要在這裡表態。 */
const NON_THEME_LITERALS = new Set([
  'bi-theme', // localStorage key
  'bi-theme-family', // localStorage key
  'system', // 「跟隨系統」的哨兵值
  'catppuccin', // 家族名，不是主題 id
  '(prefers-color-scheme: dark)',
])

function inlineScript(html: string): string {
  return html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''
}

/**
 * 抽出 script 裡所有字串字面值，扣掉已知不是主題 id 的那些，剩下的都必須是主題。
 *
 * 前一版是抓 `'([a-z]+-[a-z-]+)'` 再篩「含有 catppuccin 或 tokyo」的，那有兩個
 * 洞：改名成 `Catppuccin-Mocha` 抽不到（字元類別只有小寫），改名成 `cat-mocha`
 * 也抽不到（篩選條件對不上）。兩種情況下這條測試都會安靜地通過，卻什麼都沒檢查。
 * 改成「白名單以外一律視為主題 id」，改名要嘛被抓到、要嘛逼人來這裡表態。
 */
function themeIdsIn(script: string): string[] {
  return [...script.matchAll(/'([^']*)'/g)]
    .map((m) => m[1]!)
    .filter((s) => !NON_THEME_LITERALS.has(s))
}

describe('index.html theme bootstrap', () => {
  it('names only themes that still exist', () => {
    const script = inlineScript(readFileSync(join(import.meta.dirname, '../index.html'), 'utf8'))
    expect(script, 'no inline script found in index.html').not.toBe('')

    const known = new Set(THEMES.map((t) => t.id))
    const named = themeIdsIn(script)
    // 一個都抽不到的話，上面的迴圈會零圈通過而什麼都沒證明
    expect(named.length, 'the script names no theme ids at all').toBeGreaterThan(0)
    for (const id of named) {
      expect(known, `index.html names a theme that no longer exists: ${id}`).toContain(id)
    }
  })

  /*
   * 這條測的是上面那條的抽取邏輯本身。少了它，抽取一旦漏掉某種改名方式，
   * 表現就只是「測試照常通過」——跟真的沒問題長得一模一樣。
   */
  it('extracts a renamed theme no matter how it was renamed', () => {
    const shapes: Record<string, string> = {
      小寫連字號: "dataset.theme = 'cat-mocha'",
      大寫: "dataset.theme = 'Catppuccin-Mocha'",
      沒有連字號: "dataset.theme = 'mocha'",
      加了後綴: "dataset.theme = 'catppuccin-mocha-v2'",
    }
    for (const [label, script] of Object.entries(shapes)) {
      expect(themeIdsIn(script), label).toHaveLength(1)
    }
    // 白名單裡的字串不能被誤認成主題
    expect(themeIdsIn("getItem('bi-theme') || 'catppuccin'")).toEqual([])
  })
})
