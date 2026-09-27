import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

const options = [
  { value: 'even', label: '均分' },
  { value: 'items', label: '明細' },
  { value: 'exact', label: '指定' },
] as const

describe('SegmentedControl', () => {
  it('is a radiogroup named by its label', () => {
    render(<SegmentedControl options={options} value="even" onChange={vi.fn()} label="分攤方式" />)
    expect(screen.getByRole('radiogroup', { name: '分攤方式' })).toBeInTheDocument()
  })

  it('checks exactly the current option', () => {
    render(<SegmentedControl options={options} value="items" onChange={vi.fn()} label="分攤方式" />)
    expect(screen.getByRole('radio', { name: '明細' })).toBeChecked()
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true'))
      .toHaveLength(1)
  })

  it('reports the option that was pressed', async () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={options} value="even" onChange={onChange} label="分攤方式" />)
    await userEvent.click(screen.getByRole('radio', { name: '指定' }))
    expect(onChange).toHaveBeenCalledWith('exact')
  })

  it('moves selection and focus together with the arrow keys', async () => {
    function Controlled() {
      const [v, setV] = useState<(typeof options)[number]['value']>('even')
      return <SegmentedControl options={options} value={v} onChange={setV} label="分攤方式" />
    }
    render(<Controlled />)
    screen.getByRole('radio', { name: '均分' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '明細' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '明細' })).toHaveFocus()
  })

  it('gives every segment a full tap target', () => {
    const css = readFileSync(join(import.meta.dirname, 'SegmentedControl.css'), 'utf8')
    expect(css).toMatch(/\.bi-segmented__option\s*{[^}]*min-height:\s*var\(--bi-tap-min\)/)
  })
})
