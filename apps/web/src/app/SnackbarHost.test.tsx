import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createUiStore } from '../stores/uiStore'
import { SnackbarHost } from './SnackbarHost'

describe('SnackbarHost', () => {
  it('runs the action and then removes the snackbar', async () => {
    const ui = createUiStore()
    const onAction = vi.fn()
    ui.getState().show({ message: '已刪除', actionLabel: '復原', onAction })
    render(<SnackbarHost store={ui} />)
    await userEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(ui.getState().queue).toEqual([])
  })

  // 父層重繪不能讓倒數重來，否則畫面一直在更新時 snackbar 永遠不會消失
  it('dismisses itself on schedule even while the page re-renders', () => {
    vi.useFakeTimers()
    try {
      const ui = createUiStore()
      ui.getState().show({ message: '已儲存' })
      const { rerender } = render(<SnackbarHost store={ui} />)
      act(() => vi.advanceTimersByTime(3000))
      rerender(<SnackbarHost store={ui} />)
      act(() => vi.advanceTimersByTime(1500))
      expect(ui.getState().queue).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows one item at a time, and the next once the first is dismissed', async () => {
    const ui = createUiStore()
    const a = ui.getState().show({ message: '第一則' })
    ui.getState().show({ message: '第二則' })
    render(<SnackbarHost store={ui} />)
    expect(screen.getByText('第一則')).toBeInTheDocument()
    expect(screen.queryByText('第二則')).not.toBeInTheDocument()
    act(() => ui.getState().dismiss(a))
    expect(screen.getByText('第二則')).toBeInTheDocument()
  })
})
