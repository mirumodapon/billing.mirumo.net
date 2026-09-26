import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Scrim } from './Scrim'

describe('Scrim', () => {
  it('calls onDismiss when clicked', async () => {
    const onDismiss = vi.fn()
    render(<Scrim onDismiss={onDismiss} />)
    await userEvent.click(screen.getByTestId('scrim'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  /*
   * 沒有 onDismiss 就是刻意不讓點背景關閉（例如 Dialog 要求明確選擇）。
   * 此時仍要擋住底下的點擊，否則使用者會點到被遮住的東西。
   */
  it('still blocks clicks when it is not dismissible', async () => {
    const behind = vi.fn()
    render(
      <div>
        <button type="button" onClick={behind}>
          後面
        </button>
        <Scrim />
      </div>,
    )
    await userEvent.click(screen.getByTestId('scrim'))
    expect(behind).not.toHaveBeenCalled()
  })

  /*
   * 遮罩是純視覺的，它的存在對螢幕閱讀器沒有意義——真正該被讀的是它上面的
   * sheet 或 dialog。被念成一個可點的東西只會干擾。
   */
  it('is hidden from assistive tech', () => {
    render(<Scrim onDismiss={vi.fn()} />)
    expect(screen.getByTestId('scrim')).toHaveAttribute('aria-hidden', 'true')
  })

  /*
   * 顏色與層級只存在於 CSS，jsdom 讀不到，所以這一半讀原始碼：證明它用的是
   * 主題感知的語意 token，不證明畫出來的深淺對。
   */
  it('uses the themed scrim colour and the overlay layer', () => {
    const css = readFileSync(join(import.meta.dirname, 'Scrim.css'), 'utf8')
    expect(css).toMatch(/background:\s*var\(--bi-scrim\)/)
    expect(css).toMatch(/z-index:\s*var\(--bi-z-overlay\)/)
  })
})
