import { MonthCalendar, Sheet, startOfMonth } from '@billing/ui'
import { useState } from 'react'
import { formatWeekday } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'

export interface DateFieldProps {
  label: string
  value: string
  onChange: (iso: string) => void
}

/**
 * 一列顯示日期，點開直接是月曆（task#97）。原本先列一排日期條、月曆當備援
 * （規格 5.4），實際用起來多一層；改成一律直接開月曆。
 */
export function DateField({ label, value, onChange }: DateFieldProps) {
  const { t, locale, date } = useI18n()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(value))

  return (
    <>
      <button
        type="button"
        className="app-row"
        aria-haspopup="dialog"
        onClick={() => {
          // 每次打開都從目前的日期那個月開始，而不是上次翻到的月份
          setMonth(startOfMonth(value))
          setOpen(true)
        }}
      >
        <span>{label}</span>
        <span className="app-row__value">
          {date(value)} ({formatWeekday(value)})
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <MonthCalendar
          month={month}
          value={value}
          onMonthChange={setMonth}
          onSelect={(iso) => {
            onChange(iso)
            setOpen(false)
          }}
          locale={locale}
          labels={{ prevMonth: t('date.prevMonth'), nextMonth: t('date.nextMonth') }}
        />
      </Sheet>
    </>
  )
}
