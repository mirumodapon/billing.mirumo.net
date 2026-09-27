import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IconDots } from '@tabler/icons-react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppBar } from './AppBar'

describe('AppBar', () => {
  it('shows the title as the page heading', () => {
    render(<AppBar title="東京五日" />)
    expect(screen.getByRole('heading', { name: '東京五日', level: 1 })).toBeInTheDocument()
  })

  it('has no back button unless onBack is given', () => {
    render(<AppBar title="旅程" />)
    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument()
  })

  /*
   * 返回鍵只有圖示，所以圖示必須帶上名稱，否則螢幕閱讀器只會念出「按鈕」。
   * 這是整個元件最容易漏掉又最難自己發現的一點。
   */
  it('names the icon-only back button', async () => {
    const onBack = vi.fn()
    render(<AppBar title="旅程" onBack={onBack} backLabel="返回" />)
    await userEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('names the icon-only action button', async () => {
    const onAction = vi.fn()
    render(
      <AppBar title="旅程" action={{ glyph: IconDots, ariaLabel: '更多', onPress: onAction }} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '更多' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  /*
   * 標題永遠置中，不管左右有沒有按鈕。做法是左右各留一個固定寬度的槽，
   * 空的時候也佔位——否則只有返回鍵時標題會被推歪。
   */
  it('reserves both side slots even when empty', () => {
    render(<AppBar title="旅程" />)
    expect(screen.getAllByTestId('appbar-slot')).toHaveLength(2)
  })

  it('sits above page content and respects the top safe area', () => {
    const css = readFileSync(join(import.meta.dirname, 'AppBar.css'), 'utf8')
    expect(css).toMatch(/z-index:\s*var\(--bi-z-appbar\)/)
    expect(css).toMatch(/\.bi-appbar__slot\s*{[^}]*min-width:\s*var\(--bi-tap-min\)/)
  })
})
