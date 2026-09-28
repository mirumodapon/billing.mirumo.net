import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthCalendar } from './MonthCalendar'

const labels = { prevMonth: '上個月', nextMonth: '下個月' }

function setup(overrides: Partial<Parameters<typeof MonthCalendar>[0]> = {}) {
  const props = {
    month: '2026-03-01',
    value: '2026-03-15',
    onSelect: vi.fn(),
    onMonthChange: vi.fn(),
    locale: 'en-US',
    labels,
    ...overrides,
  }
  render(<MonthCalendar {...props} />)
  return props
}

describe('MonthCalendar', () => {
  it('titles the month in the given locale', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'March 2026' })).toBeInTheDocument()
  })

  it('shows one button per day of the month', () => {
    setup()
    const days = screen.getAllByRole('button').filter((b) => b.dataset.day)
    expect(days).toHaveLength(31)
  })

  it('names each day with the full date', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Sunday, March 15, 2026' })).toBeInTheDocument()
  })

  it('marks the chosen day', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Sunday, March 15, 2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  // task#126：選一段日期時，頭尾是選中的，中間的另外標出來，範圍外的都不是
  it('marks both ends of a range and shades the days between', () => {
    setup({ range: { start: '2026-03-10', end: '2026-03-13' } })
    const day = (name: string) => screen.getByRole('button', { name })
    expect(day('Tuesday, March 10, 2026')).toHaveAttribute('aria-pressed', 'true')
    expect(day('Friday, March 13, 2026')).toHaveAttribute('aria-pressed', 'true')
    expect(day('Wednesday, March 11, 2026')).toHaveAttribute('data-in-range', 'true')
    expect(day('Wednesday, March 11, 2026')).toHaveAttribute('aria-pressed', 'false')
    expect(day('Sunday, March 15, 2026')).toHaveAttribute('aria-pressed', 'false')
    expect(day('Monday, March 9, 2026')).not.toHaveAttribute('data-in-range')
    expect(day('Friday, March 13, 2026')).not.toHaveAttribute('data-in-range')
  })

  it('reports a day when it is pressed', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Friday, March 20, 2026' }))
    expect(props.onSelect).toHaveBeenCalledWith('2026-03-20')
  })

  it('moves between months', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: '上個月' }))
    expect(props.onMonthChange).toHaveBeenCalledWith('2026-02-01')
    await userEvent.click(screen.getByRole('button', { name: '下個月' }))
    expect(props.onMonthChange).toHaveBeenCalledWith('2026-04-01')
  })

  it('starts the week on the requested day', () => {
    setup({ weekStart: 1 })
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Mon')
  })

  /*
   * 方向鍵只移焦點不選取。月曆有三十個格子，每按一次就選一天的話，
   * DatePicker 會在第一下就把 sheet 關掉，鍵盤使用者走不到目標日。
   */
  it('moves focus with the arrow keys without choosing', async () => {
    const props = setup()
    screen.getByRole('button', { name: 'Sunday, March 15, 2026' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Monday, March 16, 2026' })).toHaveFocus()
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it('moves a whole week with up and down', async () => {
    setup()
    screen.getByRole('button', { name: 'Sunday, March 15, 2026' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Sunday, March 22, 2026' })).toHaveFocus()
  })

  it('chooses the focused day with Enter', async () => {
    const props = setup()
    screen.getByRole('button', { name: 'Sunday, March 15, 2026' }).focus()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    expect(props.onSelect).toHaveBeenCalledWith('2026-03-16')
  })
})
