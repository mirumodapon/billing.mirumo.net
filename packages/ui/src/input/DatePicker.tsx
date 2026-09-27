import { IconChevronRight } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useRovingFocus } from '../hooks/rovingFocus'
import { Icon } from '../icons/Icon'
import { Sheet } from '../overlay/Sheet'
import { MonthCalendar } from './MonthCalendar'
import { addDays, daysBetween, eachDay, isValidIso, parseIso, startOfMonth } from './date/isoDate'

export interface DatePickerLabels {
  other: string
  calendarTitle: string
  prevMonth: string
  nextMonth: string
}

export interface DatePickerProps {
  value: string
  onChange: (iso: string) => void
  locale: string
  label: string
  labels: DatePickerLabels
  /** 旅程區間。給了就只列這幾天；沒給就列前後三天 */
  rangeStart?: string
  rangeEnd?: string
  weekStart?: 0 | 1
}

function stripDays(value: string, start?: string, end?: string): string[] {
  if (start && end && isValidIso(start) && isValidIso(end) && daysBetween(start, end) >= 0) {
    return eachDay(start, end)
  }
  return eachDay(addDays(value, -3), addDays(value, 3))
}

export function DatePicker({
  value,
  onChange,
  locale,
  label,
  labels,
  rangeStart,
  rangeEnd,
  weekStart,
}: DatePickerProps) {
  const days = stripDays(value, rangeStart, rangeEnd)
  const inStrip = days.includes(value)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(startOfMonth(value))
  const stripRef = useRef<HTMLDivElement>(null)

  const { onKeyDown, itemProps } = useRovingFocus({
    values: days,
    value: inStrip ? value : days[0]!,
    onChange,
  })

  useEffect(() => {
    // jsdom 沒有 scrollIntoView，所以用可選呼叫
    stripRef.current
      ?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [value])

  const date = new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })

  return (
    <div className="bi-datepicker">
      <div
        ref={stripRef}
        role="radiogroup"
        aria-label={label}
        className="bi-datepicker__strip"
        onKeyDown={onKeyDown}
      >
        {days.map((day) => (
          // 不加 aria-label：名稱就是看得到的字，語音操作才對得上（WCAG 2.5.3）
          <button
            key={day}
            type="button"
            role="radio"
            aria-checked={day === value}
            className="bi-datepicker__day"
            onClick={() => onChange(day)}
            {...itemProps(day)}
          >
            <span className="bi-datepicker__date">{date.format(parseIso(day))}</span>{' '}
            <span className="bi-datepicker__weekday">{weekday.format(parseIso(day))}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="bi-datepicker__other"
        aria-haspopup="dialog"
        data-current={!inStrip || undefined}
        onClick={() => {
          setMonth(startOfMonth(value))
          setOpen(true)
        }}
      >
        {/* 日期落在日期條之外時，把它寫在這裡——否則畫面上看不到目前選的是哪天 */}
        {inStrip ? labels.other : `${labels.other} · ${date.format(parseIso(value))}`}
        <Icon glyph={IconChevronRight} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={labels.calendarTitle}>
        <MonthCalendar
          month={month}
          value={value}
          onSelect={(day) => {
            onChange(day)
            setOpen(false)
          }}
          onMonthChange={setMonth}
          locale={locale}
          weekStart={weekStart}
          labels={{ prevMonth: labels.prevMonth, nextMonth: labels.nextMonth }}
        />
      </Sheet>
    </div>
  )
}
