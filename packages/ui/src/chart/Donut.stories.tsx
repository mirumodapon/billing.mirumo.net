import type { Meta, StoryObj } from '@storybook/react-vite'
import { Donut } from './Donut'

const format = (n: number) => `NT$${n.toLocaleString('en-US')}`

const meta = {
  title: 'Chart/Donut',
  component: Donut,
  args: {
    ariaLabel: '分類佔比',
    formatValue: format,
    emptyLabel: '還沒有支出',
    totalLabel: '總計',
    segments: [
      { key: 'food', label: '餐飲', value: 12400, colorKey: 'accent1' },
      { key: 'transport', label: '交通', value: 8600, colorKey: 'accent5' },
      { key: 'lodging', label: '住宿', value: 21000, colorKey: 'accent6' },
      { key: 'shopping', label: '購物', value: 5300, colorKey: 'accent10' },
      { key: 'other', label: '其他', value: 1200, colorKey: 'accent12' },
    ],
  },
} satisfies Meta<typeof Donut>
export default meta
type Story = StoryObj<typeof meta>

export const FiveCategories: Story = {}
export const SingleCategory: Story = {
  args: { segments: [{ key: 'food', label: '餐飲', value: 800, colorKey: 'accent1' }] },
}
export const Empty: Story = { args: { segments: [] } }
