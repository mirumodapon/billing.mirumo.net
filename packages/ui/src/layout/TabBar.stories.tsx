import { IconChartDonut, IconListDetails, IconSettings, IconTransfer } from '@tabler/icons-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TabBar } from './TabBar'

const TABS = [
  { value: 'expenses', label: '支出', glyph: IconListDetails },
  { value: 'stats', label: '統計', glyph: IconChartDonut },
  { value: 'settle', label: '結算', glyph: IconTransfer },
  { value: 'setup', label: '設定', glyph: IconSettings },
]

const meta = {
  title: 'Layout/TabBar',
  component: TabBar,
  // 全部必填，這裡給預設值只是滿足 CSF3 的型別要求——FourTabs 用自己的
  // render 與 state，不會用到這些值。
  args: { tabs: TABS, value: 'expenses', onChange: () => {}, label: '旅程分頁' },
} satisfies Meta<typeof TabBar>
export default meta
type Story = StoryObj<typeof meta>

// eslint 的 react-hooks/rules-of-hooks 只認得大寫開頭的函式是元件；一個
// 叫 render 的箭頭函式裡呼叫 useState 會被當成違規，所以獨立成具名元件。
function TabBarDemo() {
  const [value, setValue] = useState('expenses')
  return <TabBar label="旅程分頁" value={value} onChange={setValue} tabs={TABS} />
}

export const FourTabs: Story = {
  render: () => <TabBarDemo />,
}
