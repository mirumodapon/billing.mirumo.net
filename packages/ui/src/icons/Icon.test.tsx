import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IconPlus } from '@tabler/icons-react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from './Icon'

describe('Icon', () => {
  // 純裝飾的圖示被念出來只是噪音，旁邊通常已經有文字
  it('is hidden from assistive tech by default', () => {
    render(<Icon glyph={IconPlus} data-testid="i" />)
    expect(screen.getByTestId('i')).toHaveAttribute('aria-hidden', 'true')
  })

  // 只有圖示沒有文字的按鈕，圖示就是唯一的語意來源
  it('becomes an img with a name when given a label', () => {
    render(<Icon glyph={IconPlus} label="新增支出" />)
    expect(screen.getByRole('img', { name: '新增支出' })).toBeInTheDocument()
  })

  it('has no aria-hidden once it is labelled', () => {
    render(<Icon glyph={IconPlus} label="新增支出" />)
    expect(screen.getByRole('img')).not.toHaveAttribute('aria-hidden')
  })

  it('applies the size', () => {
    render(<Icon glyph={IconPlus} size="lg" data-testid="i" />)
    expect(screen.getByTestId('i')).toHaveAttribute('data-size', 'lg')
  })

  // 顏色靠繼承，圖示才能跟著所在按鈕的狀態變，不必逐處指定
  it('inherits colour rather than setting its own', () => {
    const css = readFileSync(join(import.meta.dirname, 'Icon.css'), 'utf8')
    expect(css).toMatch(/\.bi-icon\s*{[^}]*color:\s*inherit/)
  })
})
