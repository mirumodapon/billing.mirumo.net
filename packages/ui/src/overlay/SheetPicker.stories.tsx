import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '../primitives/Button'
import { SheetPicker } from './SheetPicker'

const CURRENCIES = [
  { value: 'TWD', label: '新台幣' },
  { value: 'JPY', label: '日圓' },
  { value: 'USD', label: '美元' },
  { value: 'KRW', label: '韓元' },
]

const meta = {
  title: 'Overlay/SheetPicker',
  component: SheetPicker,
  // 全部必填，這裡給預設值只是滿足 CSF3 的型別要求——Currency 用自己的
  // render 與 state，不會用到這些值。
  args: { open: false, title: '幣別', options: CURRENCIES, value: 'JPY', onSelect: () => {}, onClose: () => {} },
} satisfies Meta<typeof SheetPicker>
export default meta
type Story = StoryObj<typeof meta>

// eslint 的 react-hooks/rules-of-hooks 只認得大寫開頭的函式是元件；一個
// 叫 render 的箭頭函式裡呼叫 useState 會被當成違規，所以獨立成具名元件。
function CurrencyPickerDemo() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('JPY')
  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        幣別：{value}
      </Button>
      <SheetPicker
        open={open}
        title="幣別"
        options={CURRENCIES}
        value={value}
        onSelect={setValue}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}

export const Currency: Story = {
  render: () => <CurrencyPickerDemo />,
}
