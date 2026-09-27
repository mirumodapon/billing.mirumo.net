import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SegmentedControl } from './SegmentedControl'

const meta = {
  title: 'Input/SegmentedControl',
  component: SegmentedControl,
  args: { options: [], value: '', onChange: () => undefined, label: '分攤方式' },
} satisfies Meta<typeof SegmentedControl>
export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [value, setValue] = useState('even')
  return (
    <SegmentedControl
      label="分攤方式"
      value={value}
      onChange={setValue}
      options={[
        { value: 'even', label: '均分' },
        { value: 'items', label: '明細' },
        { value: 'exact', label: '指定' },
      ]}
    />
  )
}

export const SplitMode: Story = { render: () => <Demo /> }
