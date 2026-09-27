import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useState } from 'react'
import { useRovingFocus } from '../hooks/rovingFocus'
import { Icon } from '../icons/Icon'
import { addDays, addMonths, monthGrid, parseIso, startOfMonth } from './date/isoDate'

export interface MonthCalendarLabels {
  prevMonth: string
  nextMonth: string
}

export interface MonthCalendarProps {
  /** 要顯示的月份，任何一天都可以 */
  month: string
  value: string
  onSelect: (iso: string) => void
  onMonthChange: (month: string) => void
  locale: string
  weekStart?: 0 | 1
  labels: MonthCalendarLabels
}

/** 已知是星期日的一天，用來依序產生星期標題 */
const A_SUNDAY = '2026-03-01'

export function MonthCalendar({
  month,
  value,
  onSelect,
  onMonthChange,
  locale,
  weekStart = 0,
  labels,
}: MonthCalendarProps) {
  const weeks = monthGrid(month, weekStart)
  const days = weeks.flat().filter((day): day is string => day !== null)
  const fallback = days.includes(value) ? value : days[0]!
  const [focused, setFocused] = useState(fallback)
  // 換月之後舊的焦點日不在這個月裡，退回選中日或一號
  const current = days.includes(focused) ? focused : fallback

  // 方向鍵只移焦點（setFocused），選取交給點擊與 Enter
  const { onKeyDown, itemProps } = useRovingFocus({
    values: days,
    value: current,
    onChange: setFocused,
    columns: 7,
  })

  const title = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  const full = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' })

  return (
    <div className="bi-calendar">
      <div className="bi-calendar__header">
        <button
          type="button"
          className="bi-calendar__nav"
          onClick={() => onMonthChange(addMonths(month, -1))}
        >
          <Icon glyph={IconChevronLeft} ariaLabel={labels.prevMonth} />
        </button>
        <h3 className="bi-calendar__title">{title.format(parseIso(startOfMonth(month)))}</h3>
        <button
          type="button"
          className="bi-calendar__nav"
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          <Icon glyph={IconChevronRight} ariaLabel={labels.nextMonth} />
        </button>
      </div>
      <table className="bi-calendar__grid" onKeyDown={onKeyDown}>
        <thead>
          <tr>
            {Array.from({ length: 7 }, (_, i) => (
              <th key={i} scope="col" className="bi-calendar__weekday">
                {weekday.format(parseIso(addDays(A_SUNDAY, weekStart + i)))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, d) => (
                <td key={d}>
                  {day ? (
                    <button
                      type="button"
                      className="bi-calendar__day"
                      data-day={day}
                      aria-label={full.format(parseIso(day))}
                      aria-pressed={day === value}
                      onClick={() => onSelect(day)}
                      {...itemProps(day)}
                    >
                      {Number(day.slice(8))}
                    </button>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
