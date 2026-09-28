import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IconPlus } from '@tabler/icons-react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Fab } from './Fab'

describe('Fab', () => {
  // 只有圖示，所以 label 是輔助科技唯一的線索
  it('is a button named by its label', () => {
    render(<Fab glyph={IconPlus} ariaLabel="新增支出" onPress={vi.fn()} />)
    expect(screen.getByRole('button', { name: '新增支出' })).toBeInTheDocument()
  })

  it('runs its action', async () => {
    const onPress = vi.fn()
    render(<Fab glyph={IconPlus} ariaLabel="新增支出" onPress={onPress} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('is a type=button so it never submits a surrounding form', () => {
    render(<Fab glyph={IconPlus} ariaLabel="新增支出" onPress={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  /*
   * FAB 浮在 tab bar 之上，所以底部間距要同時算進 safe area 與 tab bar 的高度。
   * 只留 safe area 的話，在有 home indicator 的機型上它會壓在分頁列上面。
   */
  it('clears both the safe area and the tab bar', () => {
    const css = readFileSync(join(import.meta.dirname, 'Fab.css'), 'utf8')
    const bottom = css.match(/\.bi-fab\s*{[^}]*bottom:([^;]+);/)?.[1] ?? ''
    expect(bottom, 'the fab does not account for the safe area').toContain('--bi-safe-bottom')
    /*
     * 原本這裡寫的是 toMatch(/calc\(/)，而那只要有一個 calc( 就通過，不管
     * 裡面算什麼——把分頁列那一項換成 0px 照樣綠燈，Fab 就會壓在分頁列上，
     * 兩個都變難點。
     *
     * 改成要求它引用共用的高度 token。分頁列的實際高度由 min-height、padding
     * 與內容一起決定，寫死一個數字在猜的話，改任何一項兩者就不同步了。
     */
    expect(bottom, 'the fab does not clear the tab bar').toContain('--bi-tabbar-height')
  })

  // task#123：沒有分頁列的畫面，底部間距與右邊一樣，只留 safe area 加一格
  it('keeps the same gap below as on the right where there is no tab bar', () => {
    render(<Fab glyph={IconPlus} ariaLabel="新增旅程" onPress={vi.fn()} overTabBar={false} />)
    expect(screen.getByRole('button')).toHaveClass('bi-fab', 'bi-fab--no-tabbar')
    const css = readFileSync(join(import.meta.dirname, 'Fab.css'), 'utf8')
    const right = css.match(/\.bi-fab\s*{[^}]*right:([^;]+);/)?.[1]?.trim()
    const bottom = css.match(/\.bi-fab--no-tabbar\s*{[^}]*bottom:([^;]+);/)?.[1]?.trim()
    expect(bottom).toBe(right?.replace('--bi-safe-right', '--bi-safe-bottom'))
  })

  it('clears the tab bar by default', () => {
    render(<Fab glyph={IconPlus} ariaLabel="新增支出" onPress={vi.fn()} />)
    expect(screen.getByRole('button')).not.toHaveClass('bi-fab--no-tabbar')
  })

  it('sits on the fab layer with a raised shadow', () => {
    const css = readFileSync(join(import.meta.dirname, 'Fab.css'), 'utf8')
    expect(css).toMatch(/z-index:\s*var\(--bi-z-fab\)/)
    expect(css).toMatch(/box-shadow:\s*var\(--bi-shadow-raised\)/)
  })
})
