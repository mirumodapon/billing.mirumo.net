import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '../primitives/Button'
import { Sheet } from './Sheet'

const meta = {
  title: 'Overlay/Sheet',
  component: Sheet,
  // Sheet 的 props 全是必填，這裡給預設值只是為了滿足 CSF3 的型別要求——
  // 下面的 Interactive story 用自己的 render 與 state，不會用到這些值。
  args: { open: false, onClose: () => {}, title: '選擇幣別', children: null },
} satisfies Meta<typeof Sheet>
export default meta
type Story = StoryObj<typeof meta>

// eslint 的 react-hooks/rules-of-hooks 只認得大寫開頭的函式是元件；一個
// 叫 render 的箭頭函式裡呼叫 useState 會被當成違規，所以獨立成具名元件。
function InteractiveSheetDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <Button onClick={() => setOpen(true)}>開啟</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="選擇幣別">
        <p style={{ color: 'var(--bi-text)' }}>往下拖把手可以關閉，放開時依速度決定回彈或關閉。</p>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          關閉
        </Button>
      </Sheet>
    </div>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveSheetDemo />,
}
