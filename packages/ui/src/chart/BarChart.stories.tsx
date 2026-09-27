import type { Meta, StoryObj } from '@storybook/react-vite'
import { BarChart } from './BarChart'

const meta = {
  title: 'Chart/BarChart',
  component: BarChart,
  args: {
    ariaLabel: '每日花費',
    formatValue: (n: number) => `NT$${n.toLocaleString('en-US')}`,
    formatTick: (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n)),
    budgetLabel: '預算',
    overBudgetLabel: '超支',
    emptyLabel: '還沒有支出',
    budget: 3000,
    bars: [
      { key: '1', label: '3/14', value: 2100 },
      { key: '2', label: '3/15', value: 3000 },
      { key: '3', label: '3/16', value: 4200 },
      { key: '4', label: '3/17', value: 1800 },
      { key: '5', label: '3/18', value: 3600 },
    ],
  },
} satisfies Meta<typeof BarChart>
export default meta
type Story = StoryObj<typeof meta>

export const WithBudget: Story = {}
export const NoBudget: Story = { args: { budget: undefined } }
export const Empty: Story = { args: { bars: [] } }
