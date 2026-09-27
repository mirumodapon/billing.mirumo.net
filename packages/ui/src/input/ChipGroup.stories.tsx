import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChipGroup } from './ChipGroup'

const meta = {
  title: 'Input/ChipGroup',
  component: ChipGroup,
  args: { options: [], value: '', onChange: () => undefined, label: '付款方式' },
} satisfies Meta<typeof ChipGroup>
export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [value, setValue] = useState('cash')
  return (
    <ChipGroup
      label="付款方式"
      value={value}
      onChange={setValue}
      options={[
        { value: 'cash', label: '現金', colorKey: 'accent4' },
        { value: 'credit', label: '信用卡', colorKey: 'accent8' },
        { value: 'mobile', label: '行動支付', colorKey: 'accent10' },
      ]}
    />
  )
}

export const PaymentMethod: Story = { render: () => <Demo /> }
