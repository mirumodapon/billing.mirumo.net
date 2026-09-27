import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ColorSwatches } from './ColorSwatches'

const keys = Array.from({ length: 12 }, (_, i) => `accent${i + 1}`)

const meta = {
  title: 'Input/ColorSwatches',
  component: ColorSwatches,
  args: { keys, value: 'accent1', onChange: () => undefined, label: '顏色', labelFor: (k: string) => k },
} satisfies Meta<typeof ColorSwatches>
export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [value, setValue] = useState('accent1')
  return (
    <ColorSwatches
      keys={keys}
      value={value}
      onChange={setValue}
      label="顏色"
      labelFor={(k) => `顏色 ${k.replace('accent', '')}`}
    />
  )
}

export const TwelveSlots: Story = { render: () => <Demo /> }
