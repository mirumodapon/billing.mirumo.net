import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '../primitives/Button'
import { PageTransition } from './PageTransition'

const meta = {
  title: 'Motion/PageTransition',
  component: PageTransition,
  // PageTransition 的 props 全是必填，這裡給預設值只是為了滿足 CSF3 的型別要求——
  // 下面的 PushAndPop story 用自己的 render 與 state，不會用到這些值。
  args: { routeKey: '0', direction: 'forward', children: null },
} satisfies Meta<typeof PageTransition>
export default meta
type Story = StoryObj<typeof meta>

// eslint 的 react-hooks/rules-of-hooks 只認得大寫開頭的函式是元件；一個
// 叫 render 的箭頭函式裡呼叫 useState 會被當成違規，所以獨立成具名元件。
function PageTransitionPushAndPopDemo() {
  const [page, setPage] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 'var(--bi-space-2)' }}>
        <Button
          onClick={() => {
            setDirection('forward')
            setPage((p) => p + 1)
          }}
        >
          推入
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setDirection('back')
            setPage((p) => Math.max(0, p - 1))
          }}
        >
          返回
        </Button>
      </div>
      <PageTransition routeKey={String(page)} direction={direction}>
        <div style={{ padding: 'var(--bi-space-6)', color: 'var(--bi-text)' }}>第 {page} 頁</div>
      </PageTransition>
    </div>
  )
}

export const PushAndPop: Story = {
  render: () => <PageTransitionPushAndPopDemo />,
}
