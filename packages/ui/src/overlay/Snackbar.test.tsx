import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Snackbar } from './Snackbar'

describe('Snackbar', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('renders nothing when closed', () => {
    render(<Snackbar open={false} message="已刪除" onDismiss={vi.fn()} />)
    expect(screen.queryByText('已刪除')).not.toBeInTheDocument()
  })

  /*
   * status 而不是 alert：訊息是「事情做完了」，不是警告。alert 會打斷
   * 螢幕閱讀器正在念的內容，對一則過幾秒就消失的通知來說太粗暴。
   */
  it('announces itself politely', () => {
    render(<Snackbar open message="已刪除" onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('已刪除')
  })

  it('shows the action when one is given', () => {
    render(
      <Snackbar open message="已刪除" actionLabel="復原" onAction={vi.fn()} onDismiss={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: '復原' })).toBeInTheDocument()
  })

  it('has no action button when none is given', () => {
    render(<Snackbar open message="已儲存" onDismiss={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('runs the action and dismisses', async () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(
      <Snackbar
        open
        message="已刪除"
        actionLabel="復原"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('dismisses itself once the countdown runs out', () => {
    const onDismiss = vi.fn()
    render(<Snackbar open message="已刪除" durationMs={4000} onDismiss={onDismiss} />)
    act(() => void vi.advanceTimersByTime(3999))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  /*
   * 計時器必須隨元件收掉。留著的話，使用者按了復原、snackbar 消失，
   * 幾秒後那個舊計時器仍會觸發 onDismiss——而呼叫端很可能把 onDismiss
   * 當成「確定刪除」的時機，於是剛復原的東西又被刪掉。
   */
  it('cancels its timer when it closes', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(
      <Snackbar open message="已刪除" durationMs={4000} onDismiss={onDismiss} />,
    )
    rerender(<Snackbar open={false} message="已刪除" durationMs={4000} onDismiss={onDismiss} />)
    act(() => void vi.advanceTimersByTime(8000))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  // 倒數重新開始，否則第二則訊息會繼承前一則剩下的時間
  it('restarts the countdown when the message changes', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(
      <Snackbar open message="已刪除 A" durationMs={4000} onDismiss={onDismiss} />,
    )
    act(() => void vi.advanceTimersByTime(3000))
    rerender(<Snackbar open message="已刪除 B" durationMs={4000} onDismiss={onDismiss} />)
    act(() => void vi.advanceTimersByTime(3000))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1000))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
