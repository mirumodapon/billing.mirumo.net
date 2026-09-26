import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

const base = {
  title: '刪除這筆支出？',
  confirmLabel: '刪除',
  cancelLabel: '取消',
}

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(<Dialog {...base} open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a modal dialog named by its title', () => {
    render(<Dialog {...base} open onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: '刪除這筆支出？' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  /*
   * Dialog 刻意不能點背景關閉。它出現就是因為需要一個明確的決定，
   * 而背景是整個螢幕上最大、最容易誤觸的區域——讓它等於「取消」太危險。
   * Sheet 相反，那是可以隨手收掉的東西。
   */
  it('does not close when the scrim is clicked', async () => {
    const onCancel = vi.fn()
    render(<Dialog {...base} open onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByTestId('scrim'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  // Escape 仍然要能取消：鍵盤使用者需要一條不必找按鈕的退路
  it('cancels on Escape', async () => {
    const onCancel = vi.fn()
    render(<Dialog {...base} open onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('runs the confirm action', async () => {
    const onConfirm = vi.fn()
    render(<Dialog {...base} open onConfirm={onConfirm} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('runs the cancel action', async () => {
    const onCancel = vi.fn()
    render(<Dialog {...base} open onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  /*
   * 破壞性動作要用 danger 樣式。這不只是好看——它是使用者在按下去之前
   * 唯一的視覺警告。
   */
  it('styles a destructive confirm as danger', () => {
    render(<Dialog {...base} open destructive onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: '刪除' })).toHaveAttribute('data-variant', 'danger')
  })

  it('defaults the confirm to the primary style', () => {
    render(<Dialog {...base} open onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: '刪除' })).toHaveAttribute('data-variant', 'primary')
  })

  /*
   * 焦點要落在取消而不是確認。誤觸的成本不對稱：多按一次確認只是麻煩，
   * 誤刪一筆支出要重新輸入。
   */
  it('starts with focus on cancel, not confirm', () => {
    render(<Dialog {...base} open destructive onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus()
  })
})
