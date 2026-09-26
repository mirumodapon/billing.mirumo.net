import type { Meta, StoryObj } from '@storybook/react-vite'
import { SafeArea } from './SafeArea'

const meta = { title: 'Layout/SafeArea', component: SafeArea } satisfies Meta<typeof SafeArea>
export default meta
type Story = StoryObj<typeof meta>

export const Bottom: Story = {
  args: {
    edges: ['bottom'],
    children: (
      <div style={{ background: 'var(--bi-surface)', padding: 'var(--bi-space-4)' }}>
        桌機看不出差別，iOS 實機才會在底部留出 home indicator 的空間
      </div>
    ),
  },
}
