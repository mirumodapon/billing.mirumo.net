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
  it('does not close when it was given no onDismiss', async () => {
    render(<Scrim />)
    // 沒有 handler 就不該有任何反應，點下去也不能拋錯
    await expect(userEvent.click(screen.getByTestId('scrim'))).resolves.toBeUndefined()
  })

  /*
   * 擋住底下的點擊是版面的性質，不是事件的性質：一層 position: fixed 且
   * inset: 0、z-index 夠高的元素本來就會攔下指標事件。
   *
   * jsdom 不做版面計算，所以這件事在這裡根本測不出來——先前那條「點 scrim
   * 時底下的按鈕不該被呼叫」永遠會通過，因為在 jsdom 裡點擊本來就打不到
   * 底下那顆按鈕，跟 Scrim 存不存在無關。改成檢查真正負責這件事的宣告。
   */
  it('covers the whole viewport, which is what blocks the content below', () => {
    const css = readFileSync(join(import.meta.dirname, 'Scrim.css'), 'utf8')
    const rule = css.match(/\.bi-scrim\s*{([^}]*)}/)?.[1] ?? ''
    expect(rule, 'no .bi-scrim rule found').not.toBe('')
    expect(rule).toMatch(/position:\s*fixed/)
    expect(rule).toMatch(/inset:\s*0/)
    expect(rule).toMatch(/z-index:\s*var\(--bi-z-overlay\)/)
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
