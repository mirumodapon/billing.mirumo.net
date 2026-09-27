import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
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

  /*
   * 上面那條只證明 CSS 規則在，證明不了它會被套用。拿掉 data-dragging
   * 之後那條規則永遠匹配不到，而測試照樣全綠——手指移動時每一幀都被
   * 280ms 的過渡追著跑，sheet 變得像黏在糖漿裡，卻沒有任何東西報錯。
   */
  it('marks itself as dragging so that rule can match', () => {
    render(
      <Sheet open onClose={vi.fn()} title="選擇幣別">
        內容
      </Sheet>,
    )
    const handle = document.querySelector('.bi-sheet__handle')!
    fireEvent(
      handle,
      Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 1, clientY: 0 }),
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('data-dragging', 'true')
  })

  /*
   * 只有把手可以拖。整張 sheet 都可拖的話，裡面的捲動清單永遠搶不到手勢——
   * 使用者想往下捲內容，結果把整張 sheet 拉下來關掉了。
   */
  it('drags only by the handle, so content inside can still scroll', () => {
    render(
      <Sheet open onClose={vi.fn()} title="選擇幣別">
        <p data-testid="body-text">很長的內容</p>
      </Sheet>,
    )
    const body = screen.getByTestId('body-text')
    fireEvent(
      body,
      Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 1, clientY: 0 }),
    )
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-dragging')
  })
})

/*
 * task#100：內容比 sheet 高時要能捲。CSS 不進 jsdom，這裡只能證明規則寫了；
 * 真正的效果在瀏覽器量過（修正前「建立」鍵在 y=773、視窗 667，沒有任何可捲的元素）。
 */
describe('Sheet: tall content', () => {
  const css = readFileSync(join(import.meta.dirname, 'Sheet.css'), 'utf8')
  it('lets its body shrink below its content so it scrolls instead of running off screen', () => {
    expect(css).toMatch(/\.bi-sheet > \.bi-safe\s*{[^}]*min-height:\s*0/)
    expect(css).toMatch(/\.bi-sheet__body\s*{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/)
  })
})
