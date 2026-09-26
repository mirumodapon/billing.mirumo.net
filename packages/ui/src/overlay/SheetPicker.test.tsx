import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SheetPicker } from './SheetPicker'

const options = [
  { value: 'TWD', label: '新台幣' },
  { value: 'JPY', label: '日圓' },
  { value: 'USD', label: '美元' },
]

describe('SheetPicker', () => {
  /*
   * radiogroup 而不是 listbox：這是單選，而且選項就在畫面上全部列出。
   * radio 的語意讓螢幕閱讀器會念出「三個之中的第二個，已選取」。
   */
  it('is a radiogroup named by its title', () => {
    render(
      <SheetPicker open title="幣別" options={options} value="JPY" onSelect={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByRole('radiogroup', { name: '幣別' })).toBeInTheDocument()
  })

  it('marks the current value as checked and the others not', () => {
    render(
      <SheetPicker open title="幣別" options={options} value="JPY" onSelect={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByRole('radio', { name: '日圓' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '新台幣' })).not.toBeChecked()
  })

  it('reports the chosen value and closes', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <SheetPicker open title="幣別" options={options} value="JPY" onSelect={onSelect} onClose={onClose} />,
    )
    await userEvent.click(screen.getByRole('radio', { name: '美元' }))
    expect(onSelect).toHaveBeenCalledWith('USD')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders nothing when closed', () => {
    render(
      <SheetPicker
        open={false}
        title="幣別"
        options={options}
        value="JPY"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  // 每一列都是一個可點目標，必須撐到 44px
  it('gives every option a full-height tap target', () => {
    const css = readFileSync(join(import.meta.dirname, 'SheetPicker.css'), 'utf8')
    expect(css).toMatch(/\.bi-picker__option\s*{[^}]*min-height:\s*var\(--bi-tap-min\)/)
  })
})
