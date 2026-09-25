import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders its label and fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>儲存</Button>)
    await userEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        儲存
      </Button>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  // 手機上按鈕常常是表單裡唯一的提交點，型別錯了會意外送出或不送出
  it('defaults to type=button so it never submits a form by accident', () => {
    render(<Button>儲存</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('honours an explicit type', () => {
    render(<Button type="submit">儲存</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('exposes a busy state to assistive tech and blocks clicks', async () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} busy>
        儲存
      </Button>,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('forwards its ref', () => {
    const ref = { current: null as HTMLButtonElement | null }
    render(<Button ref={ref}>儲存</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
