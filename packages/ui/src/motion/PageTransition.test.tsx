import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageTransition } from './PageTransition'

describe('PageTransition', () => {
  it('renders the current page', () => {
    render(
      <PageTransition routeKey="a" direction="forward">
        <p>第一頁</p>
      </PageTransition>,
    )
    expect(screen.getByText('第一頁')).toBeInTheDocument()
  })

  it('marks the direction so the stylesheet can pick an animation', () => {
    const { rerender } = render(
      <PageTransition routeKey="a" direction="forward">
        <p>第一頁</p>
      </PageTransition>,
    )
    expect(screen.getByTestId('page')).toHaveAttribute('data-direction', 'forward')
    rerender(
      <PageTransition routeKey="b" direction="back">
        <p>第二頁</p>
      </PageTransition>,
    )
    expect(screen.getByTestId('page')).toHaveAttribute('data-direction', 'back')
  })

  /*
   * routeKey 當成 React key。少了它，換頁時 React 會重用同一個 DOM 節點，
   * 動畫不會重新播放——畫面就只是內容瞬間換掉，完全沒有推入的感覺。
   */
  it('remounts on a route change so the animation replays', () => {
    const { rerender } = render(
      <PageTransition routeKey="a" direction="forward">
        <input defaultValue="第一頁的輸入" />
      </PageTransition>,
    )
    rerender(
      <PageTransition routeKey="b" direction="forward">
        <input defaultValue="第二頁的輸入" />
      </PageTransition>,
    )
    expect(screen.getByDisplayValue('第二頁的輸入')).toBeInTheDocument()
  })

  /*
   * 兩個方向各有自己的 keyframes，而且都走 --bi-dur-page，所以
   * prefers-reduced-motion 會把它們一起歸零。
   */
  it('animates every direction off the page duration token', () => {
    const css = readFileSync(join(import.meta.dirname, 'PageTransition.css'), 'utf8')
    for (const direction of ['forward', 'back', 'up', 'down']) {
      expect(css, direction).toMatch(new RegExp(`\\[data-direction='${direction}'\\][^{]*{[^}]*animation:[^;]*--bi-dur-page`))
    }
  })
})
