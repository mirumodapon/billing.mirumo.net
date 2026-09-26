import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Accordion } from './Accordion'

const meta = {
  title: 'Layout/Accordion',
  component: Accordion,
  // Accordion 的 props 全是必填，這裡給預設值只是為了滿足 CSF3 的型別要求——
  // 下面的 FormSection story 用自己的 render 與 state，不會用到這些值。
  args: { title: '分攤方式', open: false, onToggle: () => {}, children: null },
} satisfies Meta<typeof Accordion>
export default meta
type Story = StoryObj<typeof meta>

// eslint 的 react-hooks/rules-of-hooks 只認得大寫開頭的函式是元件；一個
// 叫 render 的箭頭函式裡呼叫 useState 會被當成違規，所以獨立成具名元件。
function AccordionFormSectionDemo() {
  const [open, setOpen] = useState<string | null>('split')
  return (
    <div>
      <Accordion
        title="分攤方式"
        summary="均分・4 人"
        open={open === 'split'}
        onToggle={() => setOpen(open === 'split' ? null : 'split')}
        data-testid="split"
      >
        <p style={{ color: 'var(--bi-text-muted)' }}>展開後才看得到的分攤設定。</p>
      </Accordion>
      <Accordion
        title="明細"
        summary="3 個品項"
        open={open === 'items'}
        onToggle={() => setOpen(open === 'items' ? null : 'items')}
        data-testid="items"
      >
        <p style={{ color: 'var(--bi-text-muted)' }}>展開後才看得到的品項清單。</p>
      </Accordion>
    </div>
  )
}

export const FormSection: Story = {
  render: () => <AccordionFormSectionDemo />,
}
