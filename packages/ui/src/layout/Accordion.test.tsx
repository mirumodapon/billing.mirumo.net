import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Accordion } from './Accordion'

describe('Accordion', () => {
  it('has a header button that reports its state', () => {
    render(
      <Accordion title="分攤方式" open={false} onToggle={vi.fn()}>
        內容
      </Accordion>,
    )
    expect(screen.getByRole('button', { name: /分攤方式/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('reports expanded when open', () => {
    render(
      <Accordion title="分攤方式" open onToggle={vi.fn()}>
        內容
      </Accordion>,
    )
    expect(screen.getByRole('button', { name: /分攤方式/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('calls onToggle when the header is pressed', async () => {
    const onToggle = vi.fn()
    render(
      <Accordion title="分攤方式" open={false} onToggle={onToggle}>
        內容
      </Accordion>,
    )
    await userEvent.click(screen.getByRole('button', { name: /分攤方式/ }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  /*
   * 摘要讓收折起來的區塊仍然看得出裡面選了什麼(例如「均分・4 人」),
   * 使用者不必逐一展開檢查。這是收折表單能用的前提。
   */
  it('shows the summary in the header', () => {
    render(
      <Accordion title="分攤方式" summary="均分・4 人" open={false} onToggle={vi.fn()}>
        內容
      </Accordion>,
    )
    expect(screen.getByText('均分・4 人')).toBeInTheDocument()
  })

  /*
   * 內容永遠留在 DOM 裡,只是高度收成 0。理由有二:表單欄位的值不會因為
   * 收折而消失,而且 grid-template-rows 的過渡需要兩端都存在才動得起來。
   */
  it('keeps its content mounted while collapsed', () => {
    render(
      <Accordion title="分攤方式" open={false} onToggle={vi.fn()}>
        <input defaultValue="保留我" />
      </Accordion>,
    )
    expect(screen.getByDisplayValue('保留我')).toBeInTheDocument()
  })

  // 收起來的內容不能被 Tab 走到,否則鍵盤焦點會跑進看不見的地方
  it('hides collapsed content from assistive tech and the tab order', () => {
    render(
      <Accordion title="分攤方式" open={false} onToggle={vi.fn()} data-testid="acc">
        內容
      </Accordion>,
    )
    expect(screen.getByTestId('acc-panel')).toHaveAttribute('inert')
  })

  it('does not mark the panel inert when open', () => {
    render(
      <Accordion title="分攤方式" open onToggle={vi.fn()} data-testid="acc">
        內容
      </Accordion>,
    )
    expect(screen.getByTestId('acc-panel')).not.toHaveAttribute('inert')
  })

  /*
   * 規格 §5.5 指定用 grid-template-rows 做收折,因為它不必量測 DOM 高度。
   * 換成 max-height 會需要一個猜出來的上限值,而猜太小會截斷內容。
   */
  it('collapses with grid-template-rows rather than a guessed max-height', () => {
    const css = readFileSync(join(import.meta.dirname, 'Accordion.css'), 'utf8')
    expect(css).toMatch(/grid-template-rows:\s*0fr/)
    expect(css).toMatch(/grid-template-rows:\s*1fr/)
    expect(css).not.toMatch(/max-height/)
  })
})
