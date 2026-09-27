import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MonthCalendar } from './MonthCalendar'

const meta = {
  title: 'Input/MonthCalendar',
  component: MonthCalendar,
  args: {
    month: '2026-03-01',
    value: '2026-03-15',
    onSelect: () => undefined,
    onMonthChange: () => undefined,
    locale: 'zh-TW',
    labels: { prevMonth: '上個月', nextMonth: '下個月' },
  },
} satisfies Meta<typeof MonthCalendar>
export default meta
type Story = StoryObj<typeof meta>

function Demo({ locale }: { locale: string }) {
  const [month, setMonth] = useState('2026-03-01')
  const [value, setValue] = useState('2026-03-15')
  return (
    <MonthCalendar
      month={month}
      value={value}
      onSelect={setValue}
      onMonthChange={setMonth}
      locale={locale}
      labels={{ prevMonth: '上個月', nextMonth: '下個月' }}
    />
  )
}

export const TraditionalChinese: Story = { render: () => <Demo locale="zh-TW" /> }
export const English: Story = { render: () => <Demo locale="en-US" /> }
