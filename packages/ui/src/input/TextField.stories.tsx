import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TextField } from './TextField'

const meta = {
  title: 'Input/TextField',
  component: TextField,
  args: { label: '說明', value: '', onChange: () => undefined },
} satisfies Meta<typeof TextField>
export default meta
type Story = StoryObj<typeof meta>

function Demo({ error }: { error?: string }) {
  const [value, setValue] = useState('')
  return <TextField label="說明" value={value} onChange={setValue} placeholder="一蘭拉麵" error={error} />
}

export const Default: Story = { render: () => <Demo /> }
export const WithError: Story = { render: () => <Demo error="說明不能空白" /> }
