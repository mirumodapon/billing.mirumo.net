import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '../primitives/Button'
import { Dialog } from './Dialog'

const meta = {
  title: 'Overlay/Dialog',
  component: Dialog,
  // Dialog 的 props 全是必填，這裡給預設值只是為了滿足 CSF3 的型別要求——
  // 下面的 Destructive story 用自己的 render 與 state，不會用到這些值。
  args: {
    open: false,
    title: '刪除這筆支出？',
    confirmLabel: '刪除',
    cancelLabel: '取消',
    onConfirm: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof Dialog>
export default meta
type Story = StoryObj<typeof meta>

// eslint 的 react-hooks/rules-of-hooks 只認得大寫開頭的函式是元件；一個
// 叫 render 的箭頭函式裡呼叫 useState 會被當成違規，所以獨立成具名元件。
function DestructiveDialogDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <Button variant="danger" onClick={() => setOpen(true)}>
        刪除
      </Button>
      <Dialog
        open={open}
        title="刪除這筆支出？"
        description="這筆支出會從所有成員的分攤中移除，無法復原。"
        confirmLabel="刪除"
        cancelLabel="取消"
        destructive
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}

export const Destructive: Story = {
  render: () => <DestructiveDialogDemo />,
}
