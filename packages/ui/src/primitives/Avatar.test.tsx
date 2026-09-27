import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import type { CSSProperties } from 'react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('shows the first character of the name', () => {
    render(<Avatar name="阿明" />)
    expect(screen.getByText('阿')).toBeInTheDocument()
  })

  // name[0] 會把代理對切成半個字元、顯示成亂碼方塊。Array.from 才是按字元切
  it('does not split a surrogate pair', () => {
    render(<Avatar name="𠮷田" />)
    expect(screen.getByText('𠮷')).toBeInTheDocument()
  })

  it('exposes the full name to assistive tech', () => {
    render(<Avatar name="阿明" />)
    expect(screen.getByLabelText('阿明')).toBeInTheDocument()
  })

  it('renders an empty name without crashing', () => {
    render(<Avatar name="" />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  // 沒帶 colorKey 時必須落在一個真的槽位上。若預設值消失，這裡會算出
  // var(--bi-) —— 一個無效的 custom property，背景整個不見，而且因為
  // CSS 不會報錯，只有肉眼看得出來
  it('falls back to a real accent slot when no colour is given', () => {
    render(<Avatar name="阿明" />)
    expect(screen.getByRole('img')).toHaveStyle({ '--bi-avatar-color': 'var(--bi-accent8)' })
  })

  it('applies the colour slot', () => {
    render(<Avatar name="阿明" colorKey="accent5" />)
    expect(screen.getByRole('img')).toHaveStyle({ '--bi-avatar-color': 'var(--bi-accent5)' })
  })

  // 這是這個元件與 brief 版本分歧的地方:outlined 要留住顏色身分,
  // 不能像 brief 那樣退回 --bi-text-muted。詳見 Avatar.css 的註解。
  /*
   * 字色讀這一格自己的前景。共用一個字色的話，淺色主題有三分之二的頭像
   * 看不清（task#71）：Latte 的 accent1、accent8、accent10 要白字，其餘要黑字。
   */
  it('takes its text colour from its own slot', () => {
    render(<Avatar name="阿明" colorKey="accent5" />)
    expect(screen.getByRole('img')).toHaveStyle({ '--bi-avatar-fg': 'var(--bi-accent5-fg)' })
    const css = readFileSync(join(import.meta.dirname, 'Avatar.css'), 'utf8')
    expect(css).toMatch(/\.bi-avatar\s*{[^}]*color:\s*var\(--bi-avatar-fg\)/)
  })

  it('keeps the colour identity when outlined', () => {
    render(<Avatar name="阿明" colorKey="accent5" outlined />)
    expect(screen.getByRole('img')).toHaveStyle({ '--bi-avatar-color': 'var(--bi-accent5)' })
  })

  it('marks the outlined variant for the toggle group to style', () => {
    render(<Avatar name="阿明" outlined />)
    expect(screen.getByRole('img')).toHaveAttribute('data-outlined', 'true')
  })

  /*
   * jsdom 不做版面計算，所以這裡檢查的是 CSS 來源而非算出來的尺寸：
   * 只證明宣告還在，不證明瀏覽器量出來一樣大。之所以值得測，是因為刪掉它
   * 不會讓任何東西報錯——outlined 會靜靜地比 filled 大 4px。
   */
  it('keeps the outlined border inside the fixed size', () => {
    const css = readFileSync(join(import.meta.dirname, 'Avatar.css'), 'utf8')
    expect(css).toMatch(/\.bi-avatar\s*{[^}]*box-sizing:\s*border-box/)
  })
})

// task#76：AvatarToggleGroup 要對頭像取 ref，也要能掛 id 與 data-*
describe('Avatar as a DOM element', () => {
  it('forwards its ref', () => {
    const ref = { current: null as HTMLSpanElement | null }
    render(<Avatar ref={ref} name="阿明" />)
    expect(ref.current).toBeInstanceOf(HTMLSpanElement)
  })

  it('passes native attributes through', () => {
    render(<Avatar name="阿明" id="m1" data-member="a" aria-describedby="hint" />)
    const avatar = screen.getByRole('img', { name: '阿明' })
    expect(avatar).toHaveAttribute('id', 'm1')
    expect(avatar).toHaveAttribute('data-member', 'a')
    expect(avatar).toHaveAttribute('aria-describedby', 'hint')
  })

  // 呼叫端的 style 要跟身分色合併，不能互相取代：取代掉身分色，頭像就沒有顏色
  it('merges a passed style with its identity colour', () => {
    render(<Avatar name="阿明" colorKey="accent5" style={{ marginInlineStart: '4px' }} />)
    const avatar = screen.getByRole('img', { name: '阿明' })
    expect(avatar.style.marginInlineStart).toBe('4px')
    expect(avatar.style.getPropertyValue('--bi-avatar-color')).toBe('var(--bi-accent5)')
  })

  // 身分色只能來自 colorKey：style 帶同名變數也不能把它換掉，否則兩個人可能撞同一個顏色
  it('takes its identity colour from colorKey even when style names the same variable', () => {
    render(<Avatar name="阿明" colorKey="accent5" style={{ '--bi-avatar-color': 'var(--bi-danger)' } as CSSProperties} />)
    const avatar = screen.getByRole('img', { name: '阿明' })
    expect(avatar.style.getPropertyValue('--bi-avatar-color')).toBe('var(--bi-accent5)')
  })

  // 名字就是頭像的無障礙名稱；透傳的 role 或 aria-label 不能讓它變成別的東西
  it('keeps its own role and name over passed-through ones', () => {
    render(<Avatar name="阿明" role="button" aria-label="別的名字" />)
    expect(screen.getByRole('img', { name: '阿明' })).toBeInTheDocument()
  })
})
