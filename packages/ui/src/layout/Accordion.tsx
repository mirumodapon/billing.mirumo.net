import { IconChevronDown } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Icon } from '../icons/Icon'

export interface AccordionProps {
  title: string
  /** 收折時顯示的摘要，如「均分・4 人」。讓使用者不必展開就知道裡面選了什麼 */
  summary?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  'data-testid'?: string
}

export function Accordion({
  title,
  summary,
  open,
  onToggle,
  children,
  'data-testid': testId = 'acc',
}: AccordionProps) {
  return (
    <section className="bi-accordion" data-open={open || undefined}>
      <button type="button" className="bi-accordion__header" aria-expanded={open} onClick={onToggle}>
        <span className="bi-accordion__title">{title}</span>
        {summary ? <span className="bi-accordion__summary">{summary}</span> : null}
        <Icon glyph={IconChevronDown} />
      </button>
      {/*
       * 內容永遠掛著，只是高度收成 0：表單欄位的值不會因為收折而遺失。
       * 代價是收起來時它仍在 DOM 裡，所以要用 inert 把它排除在 Tab 順序與
       * 無障礙樹之外——否則焦點會跑進看不見的地方。
       */}
      <div className="bi-accordion__panel" data-testid={`${testId}-panel`} inert={!open}>
        <div className="bi-accordion__inner">{children}</div>
      </div>
    </section>
  )
}
