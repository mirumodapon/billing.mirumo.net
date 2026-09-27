import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BarChart } from './BarChart'

const bars = [
  { key: 'd1', label: '3/14', value: 1500 },
  { key: 'd2', label: '3/15', value: 2000 },
  { key: 'd3', label: '3/16', value: 2800 },
]
const format = (n: number) => n.toLocaleString('en-US')
const base = {
  label: '每日花費',
  formatValue: format,
  budgetLabel: '預算',
  overBudgetLabel: '超支',
  emptyLabel: '還沒有支出',
}

function xs(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 0)
}

describe('BarChart', () => {
  it('is a figure named by its label', () => {
    render(<BarChart {...base} bars={bars} budget={2000} />)
    expect(screen.getByRole('figure', { name: '每日花費' })).toBeInTheDocument()
  })

  it('draws one bar per day', () => {
    render(<BarChart {...base} bars={bars} />)
    expect(screen.getAllByTestId(/^bar-d/)).toHaveLength(3)
  })

  // dataviz 的標記規格：柱不超過 24px，讓欄位裡剩下的空間當作呼吸
  it('keeps every bar at most 24px wide', () => {
    render(<BarChart {...base} bars={bars} />)
    for (const mark of document.querySelectorAll('.bi-bar__mark')) {
      const coords = xs(mark.getAttribute('d')!)
      expect(Math.max(...coords) - Math.min(...coords)).toBeLessThanOrEqual(24)
    }
  })

  it('marks a day over budget', () => {
    render(<BarChart {...base} bars={bars} budget={2000} />)
    expect(screen.getByTestId('bar-d3')).toHaveAttribute('data-over', 'true')
  })

  // 規格說「超過」。沒有這條的話 > 換成 >= 一條測試都不會紅
  it('does not count a day that spent exactly the budget', () => {
    render(<BarChart {...base} bars={bars} budget={2000} />)
    expect(screen.getByTestId('bar-d2')).not.toHaveAttribute('data-over')
  })

  it('has no budget line and nothing over budget without a budget', () => {
    render(<BarChart {...base} bars={bars} />)
    expect(screen.queryByTestId('budget-line')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-over]')).toHaveLength(0)
  })

  it('draws the budget line at the budget value', () => {
    render(<BarChart {...base} bars={bars} budget={2000} plotHeight={160} />)
    const line = screen.getByTestId('budget-line').querySelector('line')!
    // 刻度頂是 3000，2000 在繪圖區由上往下三分之一處；繪圖區上方留 20 給數值標籤
    expect(Number(line.getAttribute('y1'))).toBeCloseTo(20 + 160 - (2000 / 3000) * 160)
  })

  // 超支日不只靠顏色：柱頂直接標出數值
  it('labels over-budget days with their amount, and only those', () => {
    render(<BarChart {...base} bars={bars} budget={2000} />)
    expect(within(screen.getByTestId('bar-d3')).getByText('2,800')).toBeInTheDocument()
    expect(within(screen.getByTestId('bar-d1')).queryByText('1,500')).not.toBeInTheDocument()
  })

  it('shows a bar’s amount when tapped, and hides it on a second tap', async () => {
    render(<BarChart {...base} bars={bars} budget={2000} />)
    const bar = screen.getByTestId('bar-d1')
    await userEvent.click(bar.querySelector('.bi-bar__hit')!)
    expect(within(bar).getByText('1,500')).toBeInTheDocument()
    await userEvent.click(bar.querySelector('.bi-bar__hit')!)
    expect(within(bar).queryByText('1,500')).not.toBeInTheDocument()
  })

  /*
   * 圖形對螢幕閱讀器沒有意義，同一份資料以表格提供，並用文字標出超支——
   * 這是超支「不只靠顏色」的另一半。
   */
  it('offers the same data as a table, naming the over-budget day', () => {
    render(<BarChart {...base} bars={bars} budget={2000} />)
    const table = screen.getByRole('table')
    const row = within(table).getByRole('row', { name: /3\/16/ })
    expect(row).toHaveTextContent('2,800')
    expect(row).toHaveTextContent('超支')
    expect(within(table).getByRole('row', { name: /3\/15/ })).not.toHaveTextContent('超支')
  })

  it('draws a negative day as an empty bar rather than a bar pointing down', () => {
    render(<BarChart {...base} bars={[{ key: 'r', label: '3/17', value: -300 }]} />)
    expect(document.querySelector('.bi-bar__mark')!.getAttribute('d')).toBe('')
  })

  it('says so when there are no days', () => {
    render(<BarChart {...base} bars={[]} />)
    expect(screen.getByText('還沒有支出')).toBeInTheDocument()
  })

  /*
   * 狀態色保留給狀態：超支用 warning，一般的柱用 accent。刻度與日期標籤用文字色
   * 而不是資料色。CSS 沒載進 jsdom，所以這一半只能讀原始碼。
   */
  it('reserves the warning colour for over-budget days and keeps text in text colours', () => {
    const css = readFileSync(join(import.meta.dirname, 'BarChart.css'), 'utf8')
    expect(css).toMatch(/\[data-over\][^{]*\.bi-bar__mark\s*{[^}]*fill:\s*var\(--bi-warning\)/)
    expect(css).toMatch(/\.bi-bar__tick,\s*\.bi-bar__label\s*{[^}]*fill:\s*var\(--bi-text-muted\)/)
    expect(css).toMatch(/\.bi-bar__budget\s*{[^}]*stroke-width:\s*2/)
    expect(css).toMatch(/\.bi-bar__grid\s*{[^}]*stroke-width:\s*1/)
  })
})
