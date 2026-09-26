import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Chip } from './Chip'

describe('Chip', () => {
  it('is a button when it can be selected', async () => {
    const onSelect = vi.fn()
    render(<Chip label="現金" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: '現金' }))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  // 不可選的 chip 是純標籤。做成 button 會讓鍵盤使用者 tab 到一個按了沒反應的東西
  it('is not a button when it cannot be selected', () => {
    render(<Chip label="現金" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('現金')).toBeInTheDocument()
  })

  it('reports selection through aria-pressed', () => {
    render(<Chip label="現金" onSelect={() => {}} selected />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not fire when disabled', async () => {
    const onSelect = vi.fn()
    render(<Chip label="現金" onSelect={onSelect} disabled />)
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows a colour dot only when a colorKey is given', () => {
    const { rerender } = render(<Chip label="阿明" colorKey="accent3" />)
    expect(screen.getByTestId('chip-dot')).toHaveStyle({ background: 'var(--bi-accent3)' })
    rerender(<Chip label="阿明" />)
    expect(screen.queryByTestId('chip-dot')).toBeNull()
  })
})
