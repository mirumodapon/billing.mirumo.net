import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProgressBar } from './ProgressBar'

const meta = {
  title: 'Primitives/ProgressBar',
  component: ProgressBar,
  args: { label: '預算進度' },
} satisfies Meta<typeof ProgressBar>
export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = { args: { ratio: 0.42, level: 'normal' } }
export const Warning: Story = { args: { ratio: 0.88, level: 'warning' } }
export const Over: Story = { args: { ratio: 1.35, level: 'over' } }
export const Empty: Story = { args: { ratio: 0 } }
