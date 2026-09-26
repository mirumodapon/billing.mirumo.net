import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IconTrash } from '@tabler/icons-react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SwipeAction } from './SwipeAction'

function pointer(el: Element, type: string, clientX: number) {
  fireEvent(el, Object.assign(new Event(type, { bubbles: true }), { pointerId: 1, clientX }))
}

describe('SwipeAction', () => {
  it('renders its children', () => {
    render(
      <SwipeAction glyph={IconTrash} actionLabel="刪除" onAction={vi.fn()}>
        <span>晚餐 1,200</span>
      </SwipeAction>,
    )
    expect(screen.getByText('晚餐 1,200')).toBeInTheDocument()
  })

  /*
   * 手勢不是唯一的入口。滑動對行動不便的使用者、對鍵盤使用者都做不到，
   * 所以露出來的動作必須是一個真的按鈕，可以 Tab 到、可以按 Enter。
   */
  it('exposes the action as a real button, not only a gesture', async () => {
    const onAction = vi.fn()
    render(
      <SwipeAction glyph={IconTrash} actionLabel="刪除" onAction={onAction}>
        <span>晚餐</span>
      </SwipeAction>,
    )
    await userEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('follows the drag', () => {
    render(
      <SwipeAction glyph={IconTrash} actionLabel="刪除" onAction={vi.fn()}>
        <span>晚餐</span>
      </SwipeAction>,
    )
    const surface = screen.getByTestId('swipe-surface')
    pointer(surface, 'pointerdown', 0)
    pointer(surface, 'pointermove', 40)
    expect(surface).toHaveStyle({ '--bi-swipe-offset': '40px' })
  })

  it('triggers the action once the swipe passes the threshold', () => {
    const onAction = vi.fn()
    render(
      <SwipeAction glyph={IconTrash} actionLabel="刪除" onAction={onAction}>
        <span>晚餐</span>
      </SwipeAction>,
    )
    const surface = screen.getByTestId('swipe-surface')
    pointer(surface, 'pointerdown', 0)
    pointer(surface, 'pointermove', 120)
    pointer(surface, 'pointerup', 120)
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('springs back when the swipe falls short', () => {
    const onAction = vi.fn()
    render(
      <SwipeAction glyph={IconTrash} actionLabel="刪除" onAction={onAction}>
        <span>晚餐</span>
      </SwipeAction>,
    )
    const surface = screen.getByTestId('swipe-surface')
    pointer(surface, 'pointerdown', 0)
    pointer(surface, 'pointermove', 20)
    pointer(surface, 'pointerup', 20)
    expect(onAction).not.toHaveBeenCalled()
    expect(surface).toHaveStyle({ '--bi-swipe-offset': '0px' })
  })

  /*
   * touch-action 必須鎖住橫向，否則瀏覽器會把橫滑當成頁面捲動搶走手勢，
   * 而在直式清單裡這正是最容易發生的衝突。
   */
  it('claims the horizontal gesture from the browser', () => {
    const css = readFileSync(join(import.meta.dirname, 'SwipeAction.css'), 'utf8')
    expect(css).toMatch(/\.bi-swipe__surface\s*{[^}]*touch-action:\s*pan-y/)
  })
})
