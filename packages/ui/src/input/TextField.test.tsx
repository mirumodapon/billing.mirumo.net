import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TextField } from './TextField'

describe('TextField', () => {
  it('is labelled by its visible label', () => {
    render(<TextField label="說明" value="" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: '說明' })).toBeInTheDocument()
  })

  it('reports each change', async () => {
    function Controlled() {
      const [v, setV] = useState('')
      return <TextField label="說明" value={v} onChange={setV} />
    }
    render(<Controlled />)
    await userEvent.type(screen.getByRole('textbox'), '拉麵')
    expect(screen.getByRole('textbox')).toHaveValue('拉麵')
  })

  it('reports leaving the field', async () => {
    const onBlur = vi.fn()
    render(<TextField label="名稱" value="" onChange={() => {}} onBlur={onBlur} />)
    await userEvent.click(screen.getByLabelText('名稱'))
    expect(onBlur).not.toHaveBeenCalled()
    await userEvent.tab()
    expect(onBlur).toHaveBeenCalledOnce()
  })

  it('marks itself invalid and points at the message when there is an error', () => {
    render(<TextField label="姓名" value="" onChange={vi.fn()} error="姓名不能空白" />)
    const input = screen.getByRole('textbox', { name: '姓名' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('姓名不能空白')
  })

  it('is not marked invalid without an error', () => {
    render(<TextField label="姓名" value="" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid')
  })

  it('passes maxLength through to the input', () => {
    render(<TextField label="姓名" value="" onChange={vi.fn()} maxLength={20} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '20')
  })

  // 規格 5.6：全域 user-select: none，輸入框要用 data-selectable 開回來
  it('opts back into text selection', () => {
    render(<TextField label="說明" value="" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('data-selectable')
  })

  /*
   * iOS Safari 對字級小於 16px 的輸入框在聚焦時會放大整個頁面而且不縮回。
   * jsdom 算不出字級，所以這裡讀原始碼：證明用的是 16px 的 token，
   * 不證明實機不會放大（那要實機驗）。
   */
  it('uses a font size iOS will not zoom in on', () => {
    const css = readFileSync(join(import.meta.dirname, 'TextField.css'), 'utf8')
    expect(css).toMatch(/\.bi-field__input\s*{[^}]*font-size:\s*var\(--bi-text-base\)/)
    const tokens = readFileSync(join(import.meta.dirname, '../styles/tokens.css'), 'utf8')
    const px = Number(tokens.match(/--bi-text-base:\s*(\d+)px/)?.[1])
    expect(px).toBeGreaterThanOrEqual(16)
  })
})
