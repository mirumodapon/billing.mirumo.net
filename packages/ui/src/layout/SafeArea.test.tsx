import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SafeArea } from './SafeArea'

describe('SafeArea', () => {
  it('renders its children', () => {
    render(<SafeArea edges={['bottom']}>內容</SafeArea>)
    expect(screen.getByText('內容')).toBeInTheDocument()
  })

  it('marks only the edges it was asked for', () => {
    render(
      <SafeArea edges={['top', 'left']} data-testid="s">
        x
      </SafeArea>,
    )
    const el = screen.getByTestId('s')
    expect(el).toHaveAttribute('data-top', 'true')
    expect(el).toHaveAttribute('data-left', 'true')
    expect(el).not.toHaveAttribute('data-bottom')
    expect(el).not.toHaveAttribute('data-right')
  })

  /*
   * env() 只能在 CSS 裡求值，jsdom 也不算版面，所以這一半只能讀原始碼：
   * 證明四個邊各自對到正確的 token，不證明瀏覽器真的留出了空間。
   */
  it('maps every edge to its own safe-area token', () => {
    const css = readFileSync(join(import.meta.dirname, 'SafeArea.css'), 'utf8')
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      expect(css, `no rule for the ${edge} edge`).toMatch(
        new RegExp(`\\[data-${edge}\\][^{]*{[^}]*padding-${edge}:\\s*var\\(--bi-safe-${edge}\\)`),
      )
    }
  })
})
