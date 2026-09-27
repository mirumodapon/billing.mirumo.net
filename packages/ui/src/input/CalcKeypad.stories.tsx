import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { CalcKeypad } from './CalcKeypad'

const meta = {
  title: 'Input/CalcKeypad',
  component: CalcKeypad,
  args: {
    open: true,
    expression: '',
    decimals: 0,
    onExpressionChange: () => undefined,
    onDone: () => undefined,
    labels: { done: '完成', clear: 'C', backspace: '刪除一位' },
  },
} satisfies Meta<typeof CalcKeypad>
export default meta
type Story = StoryObj<typeof meta>

function Demo({ decimals }: { decimals: number }) {
  const [expression, setExpression] = useState('')
  const [last, setLast] = useState<number | null>(null)
  return (
    <div style={{ color: 'var(--bi-text)', padding: 'var(--bi-space-4)' }}>
      <p>上次完成：{last ?? '（無）'}</p>
      <CalcKeypad
        open
        expression={expression}
        decimals={decimals}
        onExpressionChange={setExpression}
        onDone={setLast}
        labels={{ done: '完成', clear: 'C', backspace: '刪除一位' }}
        header={<span style={{ color: 'var(--bi-text-muted)' }}>JPY</span>}
      />
    </div>
  )
}

export const ZeroDecimals: Story = { render: () => <Demo decimals={0} /> }
export const TwoDecimals: Story = { render: () => <Demo decimals={2} /> }
