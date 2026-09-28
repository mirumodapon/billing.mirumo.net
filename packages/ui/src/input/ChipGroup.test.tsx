import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ChipGroup, type ChipOption } from './ChipGroup'

const options: ChipOption[] = [
  { value: 'cash', label: '現金' },
  { value: 'credit', label: '信用卡', colorKey: 'accent3' },
  { value: 'mobile', label: '行動支付' },
]

describe('ChipGroup', () => {
  it('is a radiogroup of radios, not a row of toggle buttons', () => {
    render(<ChipGroup options={options} value="cash" onChange={vi.fn()} ariaLabel="付款方式" />)
    expect(screen.getByRole('radiogroup', { name: '付款方式' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    // Chip 元件用的是 aria-pressed；混進來的話語意就錯了
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toHaveAttribute('aria-pressed')
    }
  })

  it('checks the current option and marks it for the chip style', () => {
    render(<ChipGroup options={options} value="credit" onChange={vi.fn()} ariaLabel="付款方式" />)
    const radio = screen.getByRole('radio', { name: '信用卡' })
    expect(radio).toBeChecked()
    expect(radio).toHaveAttribute('data-selected', 'true')
  })

  it('reports the option that was pressed', async () => {
    const onChange = vi.fn()
    render(<ChipGroup options={options} value="cash" onChange={onChange} ariaLabel="付款方式" />)
    await userEvent.click(screen.getByRole('radio', { name: '行動支付' }))
    expect(onChange).toHaveBeenCalledWith('mobile')
  })

  it('draws the colour dot only for options that have one', () => {
    render(<ChipGroup options={options} value="cash" onChange={vi.fn()} ariaLabel="付款方式" />)
    const dots = screen.getAllByTestId('chip-dot')
    expect(dots).toHaveLength(1)
    expect(dots[0]).toHaveStyle({ background: 'var(--bi-accent3)' })
  })

  it('moves selection and focus with the arrow keys', async () => {
    function Controlled() {
      const [v, setV] = useState('cash')
      return <ChipGroup options={options} value={v} onChange={setV} ariaLabel="付款方式" />
    }
    render(<Controlled />)
    screen.getByRole('radio', { name: '現金' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '信用卡' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: '信用卡' })).toBeChecked()
  })
})

describe('ChipGroup with nothing chosen yet', () => {
  // 還沒選任何一個（例如新支出的類別）：第一個仍要能用 Tab 進來，否則鍵盤使用者進不了這一組
  it('keeps the first chip reachable with Tab, and none checked', async () => {
    render(<ChipGroup options={options} value="" onChange={vi.fn()} ariaLabel="付款方式" />)
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['0', ...radios.slice(1).map(() => '-1')])
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
    await userEvent.tab()
    expect(radios[0]).toHaveFocus()
  })
})
