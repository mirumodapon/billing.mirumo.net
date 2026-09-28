import { MonthCalendar, Sheet, startOfMonth } from '@billing/ui'
import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

export interface DateRangeFieldProps {
  label: string
  start: string
  end: string
  onChange: (start: string, end: string) => void
}

/**
 * 旅行時間：一列顯示區間，點開是一個月曆，點兩次就設好開始與結束（task#126）。
 * 兩次點的先後不拘，早的那天就是開始；同一天點兩次是一日遊。
 * 點第一下之後、第二下之前，月曆上只標出第一下那天。
 */
export function DateRangeField({ label, start, end, onChange }: DateRangeFieldProps) {
  const { t, locale, dateRange } = useI18n()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(start))
  const [first, setFirst] = useState<string | null>(null)

  const pick = (day: string) => {
    if (first === null) {
      setFirst(day)
      return
    }
    const [from, to] = first <= day ? [first, day] : [day, first]
    setFirst(null)
    setOpen(false)
    onChange(from, to)
  }

  return (
    <>
      <button
        type="button"
        className="app-row"
        aria-haspopup="dialog"
        onClick={() => {
          // 每次打開都從出發那個月開始，重新點兩下
          setMonth(startOfMonth(start))
          setFirst(null)
          setOpen(true)
        }}
      >
        <span>{label}</span>
        <span className="app-row__value">{dateRange(start, end)}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <p className="app-field-label m-0" aria-live="polite" data-testid="range-step">
          {first === null ? t('date.pickStart') : t('date.pickEnd')}
        </p>
        <MonthCalendar
          month={month}
          value={first ?? start}
          range={first === null ? { start, end } : { start: first, end: first }}
          onMonthChange={setMonth}
          onSelect={pick}
          locale={locale}
          labels={{ prevMonth: t('date.prevMonth'), nextMonth: t('date.nextMonth') }}
        />
      </Sheet>
    </>
  )
}
