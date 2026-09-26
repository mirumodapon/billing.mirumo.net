import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(
      <Sheet open={false} onClose={vi.fn()} title="選擇幣別">
        內容
      </Sheet>,
    )
    expect(screen.queryByText('內容')).not.toBeInTheDocument()
  })

  it('is a dialog with an accessible name when open', () => {
    render(
      <Sheet open onClose={vi.fn()} title="選擇幣別">
        內容
      </Sheet>,
    )
    expect(screen.getByRole('dialog', { name: '選擇幣別' })).toBeInTheDocument()
  })

  it('is modal so assistive tech ignores the page behind it', () => {
    render(
      <Sheet open onClose={vi.fn()} title="選擇幣別">
        內容
      </Sheet>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('closes when the scrim is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="選擇幣別">
        內容
      </Sheet>,
    )
    await userEvent.click(screen.getByTestId('scrim'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="選擇幣別">
        <button type="button">裡面</button>
      </Sheet>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('moves focus inside when it opens', async () => {
    render(
      <Sheet open onClose={vi.fn()} title="選擇幣別">
        <button type="button">裡面</button>
      </Sheet>,
    )
    expect(screen.getByRole('button', { name: '裡面' })).toHaveFocus()
  })

  /*
   * 拖曳把位移寫進 CSS 變數而不是 style.transform，是為了讓 CSS 決定
   * 「拖曳中不要有過渡動畫、放開才要」。這裡只證明變數有被設定。
   */
  it('exposes the drag offset as a custom property', () => {
    render(
      <Sheet open onClose={vi.fn()} title="選擇幣別">
        內容
      </Sheet>,
    )
    expect(screen.getByRole('dialog')).toHaveStyle({ '--bi-sheet-drag': '0px' })
  })

  /*
   * CSS 沒載進 jsdom，所以這一半讀原始碼。證明的是「拖曳中關掉過渡」這個
   * 規則存在——少了它，手指移動時每一幀都會被 280ms 的過渡追著跑，變成拖不動。
   */
  it('disables the transition while dragging', () => {
    const css = readFileSync(join(import.meta.dirname, 'Sheet.css'), 'utf8')
    expect(css).toMatch(/\[data-dragging\][^{]*{[^}]*transition:\s*none/)
  })
})
