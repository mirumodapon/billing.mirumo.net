import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DatePicker } from './DatePicker'

const labels = { other: '其他日期', calendarTitle: '選擇日期', prevMonth: '上個月', nextMonth: '下個月' }

function setup(overrides: Partial<Parameters<typeof DatePicker>[0]> = {}) {
  const props = {
    value: '2026-03-15',
    onChange: vi.fn(),
    locale: 'en-US',
    ariaLabel: '日期',
    labels,
    rangeStart: '2026-03-14',
    rangeEnd: '2026-03-18',
    ...overrides,
  }
  render(<DatePicker {...props} />)
  return props
}

describe('DatePicker', () => {
  it('is a radiogroup of the trip days', () => {
    setup()
    expect(screen.getByRole('radiogroup', { name: '日期' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  // 名稱就是看得到的字，語音操作說「點 3/15」才找得到
  it('names each day by exactly what it shows', () => {
    setup()
    expect(screen.getByRole('radio', { name: '3/15 Sun' })).toBeChecked()
  })

  it('formats weekdays in the given locale', () => {
    setup({ locale: 'zh-TW' })
    expect(screen.getByRole('radio', { name: /3\/15.*週日/ })).toBeInTheDocument()
  })

  it('reports the day that was pressed', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('radio', { name: '3/16 Mon' }))
    expect(props.onChange).toHaveBeenCalledWith('2026-03-16')
  })

  it('moves selection and focus with the arrow keys', async () => {
    function Controlled() {
      const [value, setValue] = useState('2026-03-15')
      return (
        <DatePicker
          value={value}
          onChange={setValue}
          locale="en-US"
          ariaLabel="日期"
          labels={labels}
          rangeStart="2026-03-14"
          rangeEnd="2026-03-18"
        />
      )
    }
    render(<Controlled />)
    screen.getByRole('radio', { name: '3/15 Sun' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '3/16 Mon' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '3/16 Mon' })).toHaveFocus()
  })

  it('shows a week around the value when there is no trip range', () => {
    setup({ rangeStart: undefined, rangeEnd: undefined })
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(7)
    expect(radios[0]).toHaveAccessibleName('3/12 Thu')
    expect(radios[6]).toHaveAccessibleName('3/18 Wed')
  })

  // 日期不在旅程區間裡時，日期條不能假裝選中了某一天
  it('checks nothing when the value is outside the strip, and says so on the escape hatch', () => {
    setup({ value: '2026-03-02' })
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true'))
      .toHaveLength(0)
    expect(screen.getByRole('button', { name: /其他日期.*3\/2/ })).toBeInTheDocument()
  })

  it('opens the full calendar and closes it after a choice', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /其他日期/ }))
    expect(screen.getByRole('dialog', { name: '選擇日期' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Friday, March 27, 2026' }))
    expect(props.onChange).toHaveBeenCalledWith('2026-03-27')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
