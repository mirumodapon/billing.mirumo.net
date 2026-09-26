import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '../primitives/Button'
import { Snackbar } from './Snackbar'

const meta = {
  title: 'Overlay/Snackbar',
  component: Snackbar,
  // 全部必填，這裡給預設值只是滿足 CSF3 的型別要求——WithUndo 用自己的
  // render 與 state，不會用到這些值。
  args: { open: false, message: '已刪除', onDismiss: () => {} },
} satisfies Meta<typeof Snackbar>
export default meta
type Story = StoryObj<typeof meta>

// eslint 的 react-hooks/rules-of-hooks 只認得大寫開頭的函式是元件；一個
// 叫 render 的箭頭函式裡呼叫 useState 會被當成違規，所以獨立成具名元件。
function UndoSnackbarDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <Button variant="danger" onClick={() => setOpen(true)}>
        刪除
      </Button>
      <Snackbar
        open={open}
        message="已刪除「晚餐」"
        actionLabel="復原"
        onAction={() => undefined}
        onDismiss={() => setOpen(false)}
      />
    </div>
  )
}

export const WithUndo: Story = {
  render: () => <UndoSnackbarDemo />,
}
