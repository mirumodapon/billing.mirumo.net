import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IconChartDonut, IconListDetails, IconSettings, IconTransfer } from '@tabler/icons-react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TabBar } from './TabBar'

const tabs = [
  { value: 'expenses', label: '支出', glyph: IconListDetails },
  { value: 'stats', label: '統計', glyph: IconChartDonut },
  { value: 'settle', label: '結算', glyph: IconTransfer },
  { value: 'setup', label: '設定', glyph: IconSettings },
]

describe('TabBar', () => {
  it('is a tablist', () => {
    render(<TabBar tabs={tabs} value="expenses" onChange={vi.fn()} label="旅程分頁" />)
    expect(screen.getByRole('tablist', { name: '旅程分頁' })).toBeInTheDocument()
  })

  it('marks exactly one tab selected', () => {
    render(<TabBar tabs={tabs} value="stats" onChange={vi.fn()} label="旅程分頁" />)
    expect(screen.getByRole('tab', { name: '統計' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true'))
      .toHaveLength(1)
  })

  it('reports the tab that was pressed', async () => {
    const onChange = vi.fn()
    render(<TabBar tabs={tabs} value="expenses" onChange={onChange} label="旅程分頁" />)
    await userEvent.click(screen.getByRole('tab', { name: '結算' }))
    expect(onChange).toHaveBeenCalledWith('settle')
  })

  /*
   * 只有選中的分頁留在 Tab 順序裡，其餘 tabIndex=-1，方向鍵才是切換分頁的
   * 方式——這是 tablist 的標準鍵盤模型。全部都能 Tab 的話，鍵盤使用者要按
   * 四次才能離開這一列。
   */
  it('keeps only the selected tab in the tab order', () => {
    render(<TabBar tabs={tabs} value="stats" onChange={vi.fn()} label="旅程分頁" />)
    expect(screen.getByRole('tab', { name: '統計' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: '支出' })).toHaveAttribute('tabindex', '-1')
  })

  it('moves to the next tab with the right arrow', async () => {
    const onChange = vi.fn()
    render(<TabBar tabs={tabs} value="expenses" onChange={onChange} label="旅程分頁" />)
    screen.getByRole('tab', { name: '支出' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith('stats')
  })

  it('wraps from the last tab back to the first', async () => {
    const onChange = vi.fn()
    render(<TabBar tabs={tabs} value="setup" onChange={onChange} label="旅程分頁" />)
    screen.getByRole('tab', { name: '設定' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith('expenses')
  })

  it('wraps backwards from the first tab to the last', async () => {
    const onChange = vi.fn()
    render(<TabBar tabs={tabs} value="expenses" onChange={onChange} label="旅程分頁" />)
    screen.getByRole('tab', { name: '支出' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenCalledWith('setup')
  })

  it('gives every tab a full tap target and respects the bottom safe area', () => {
    const css = readFileSync(join(import.meta.dirname, 'TabBar.css'), 'utf8')
    expect(css).toMatch(/\.bi-tabbar__tab\s*{[^}]*min-height:\s*var\(--bi-tap-min\)/)
    expect(css).toMatch(/z-index:\s*var\(--bi-z-tabbar\)/)
  })

  /*
   * Plan 3 的 TabBar 只改 aria-selected 不移焦點：焦點框留在舊分頁上，
   * 螢幕閱讀器念的也是舊分頁。這條在改用 useRovingFocus 之前是紅的。
   */
  it('moves keyboard focus to the newly selected tab', async () => {
    function Controlled() {
      const [value, setValue] = useState('expenses')
      return <TabBar tabs={tabs} value={value} onChange={setValue} label="旅程分頁" />
    }
    render(<Controlled />)
    screen.getByRole('tab', { name: '支出' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: '統計' })).toHaveFocus()
  })
})
