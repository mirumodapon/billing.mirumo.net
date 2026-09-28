import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/*
 * task#76：ChipGroup 要對子元件取 ref 做焦點管理，也要掛 id 讓別處 aria-labelledby 指過來。
 * 兩種形態（純標籤、可點的 button）都要支援，因為呼叫端事先不一定知道會拿到哪一種。
 */
describe('Chip as a DOM element', () => {
  it('forwards its ref in both forms', () => {
    const plain = { current: null as HTMLElement | null }
    const { unmount } = render(<Chip ref={plain} label="現金" />)
    expect(plain.current).toBeInstanceOf(HTMLSpanElement)
    unmount()
    const pressable = { current: null as HTMLElement | null }
    render(<Chip ref={pressable} label="現金" onSelect={vi.fn()} />)
    expect(pressable.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('passes native attributes through in both forms', () => {
    const { unmount } = render(<Chip label="現金" id="c1" data-kind="pay" aria-describedby="hint" />)
    const plain = screen.getByText('現金')
    expect(plain).toHaveAttribute('id', 'c1')
    expect(plain).toHaveAttribute('data-kind', 'pay')
    expect(plain).toHaveAttribute('aria-describedby', 'hint')
    unmount()
    render(<Chip label="現金" onSelect={vi.fn()} id="c2" data-kind="pay" />)
    const button = screen.getByRole('button', { name: '現金' })
    expect(button).toHaveAttribute('id', 'c2')
    expect(button).toHaveAttribute('data-kind', 'pay')
  })

  // 選取狀態與停用是元件自己的語意，透傳的屬性不能把它們蓋掉
  it('keeps its own state attributes over passed-through ones', async () => {
    const onSelect = vi.fn()
    render(<Chip label="現金" selected={false} disabled onSelect={onSelect} aria-pressed onClick={onSelect} />)
    const button = screen.getByRole('button', { name: '現金' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })

  // 純標籤的選取樣式只看 data-selected，同樣不能被透傳的值打開
  it('keeps its own selected marker in the plain form', () => {
    render(<Chip label="現金" selected={false} data-selected="true" />)
    expect(screen.getByText('現金')).not.toHaveAttribute('data-selected')
  })
})

describe('Chip styles', () => {
  const css = readFileSync(join(import.meta.dirname, 'Chip.css'), 'utf8')

  it('keeps the tap-target height on the button form', () => {
    expect(css).toMatch(/button\.bi-chip\s*{[^}]*min-height:\s*var\(--bi-tap-min\)/)
  })

  // 純標籤放在文字行裡（列表的「草稿」）：不能把那一行撐成按鈕那麼高
  it('leaves the plain label compact', () => {
    expect(css).not.toMatch(/(^|\n)\.bi-chip\s*{[^}]*min-height/)
    expect(css).toMatch(/span\.bi-chip\s*{[^}]*padding:\s*0 /)
  })
})
