import { IconTrash } from '@tabler/icons-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SwipeAction } from './SwipeAction'

const meta = {
  title: 'Interaction/SwipeAction',
  component: SwipeAction,
  // SwipeAction 的 props 全是必填，這裡給預設值只是為了滿足 CSF3 的型別要求——
  // 下面的 ExpenseRow story 用自己的 render，不會用到這些值。
  args: { glyph: IconTrash, actionLabel: '刪除', onAction: () => undefined, children: null },
} satisfies Meta<typeof SwipeAction>
export default meta
type Story = StoryObj<typeof meta>

export const ExpenseRow: Story = {
  render: () => (
    <SwipeAction glyph={IconTrash} actionLabel="刪除" onAction={() => undefined}>
      <div
        style={{
          padding: 'var(--bi-space-4)',
          display: 'flex',
          justifyContent: 'space-between',
          color: 'var(--bi-text)',
        }}
      >
        <span>晚餐</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>1,200</span>
      </div>
    </SwipeAction>
  ),
}
