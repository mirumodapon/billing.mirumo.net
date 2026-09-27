import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { DatePicker } from './DatePicker'

const labels = { other: '其他日期', calendarTitle: '選擇日期', prevMonth: '上個月', nextMonth: '下個月' }

const meta = {
  title: 'Input/DatePicker',
  component: DatePicker,
  args: { value: '2026-03-15', onChange: () => undefined, locale: 'zh-TW', ariaLabel: '日期', labels },
} satisfies Meta<typeof DatePicker>
export default meta
type Story = StoryObj<typeof meta>

function Demo({ range }: { range: boolean }) {
  const [value, setValue] = useState('2026-03-15')
  return (
    <DatePicker
      value={value}
      onChange={setValue}
      locale="zh-TW"
      ariaLabel="日期"
      labels={labels}
      rangeStart={range ? '2026-03-14' : undefined}
      rangeEnd={range ? '2026-03-18' : undefined}
    />
  )
}

export const WithinTrip: Story = { render: () => <Demo range /> }
export const NoTripRange: Story = { render: () => <Demo range={false} /> }
