import { IconPlus } from '@tabler/icons-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Fab } from './Fab'

const meta = { title: 'Layout/Fab', component: Fab } satisfies Meta<typeof Fab>
export default meta
type Story = StoryObj<typeof meta>

export const AddExpense: Story = {
  args: { glyph: IconPlus, label: '新增支出', onPress: () => undefined },
}
