import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Donut } from './Donut'

const segments = [
  { key: 'food', label: '餐飲', value: 3000, colorKey: 'accent1' },
  { key: 'transport', label: '交通', value: 3000, colorKey: 'accent5' },
  { key: 'lodging', label: '住宿', value: 3000, colorKey: 'accent6' },
]
const format = (n: number) => `NT$${n.toLocaleString('en-US')}`
const base = { label: '分類佔比', formatValue: format, emptyLabel: '還沒有支出', totalLabel: '總計' }

describe('Donut', () => {
  it('is a figure named by its label', () => {
    render(<Donut {...base} segments={segments} />)
    expect(screen.getByRole('figure', { name: '分類佔比' })).toBeInTheDocument()
  })

  it('paints each segment from its colour slot', () => {
    render(<Donut {...base} segments={segments} />)
    expect(screen.getByTestId('donut-segment-transport')).toHaveStyle({ fill: 'var(--bi-accent5)' })
  })

  /*
   * 撞色時（task#81：accent5 與 accent6 在多數主題幾乎一樣）使用者唯一能靠的
   * 就是這份圖例，所以每一項都要有名稱、金額與百分比。
   */
  it('lists every segment with its name, amount and share', () => {
    render(<Donut {...base} segments={segments} />)
    const legend = screen.getByRole('list')
    const rows = within(legend).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('餐飲')
    expect(rows[0]).toHaveTextContent('NT$3,000')
  })

  // 三等分各自四捨五入會是 33 + 33 + 33 = 99
  it('shows shares that add up to exactly 100', () => {
    render(<Donut {...base} segments={segments} />)
    const shares = screen.getAllByTestId('donut-share').map((el) => Number(el.textContent!.replace('%', '')))
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('shows the total in the middle by default', () => {
    render(<Donut {...base} segments={segments} />)
    expect(screen.getByTestId('donut-center')).toHaveTextContent('總計')
    expect(screen.getByTestId('donut-center')).toHaveTextContent('NT$9,000')
  })

  it('focuses one segment from the legend and dims the others', async () => {
    render(<Donut {...base} segments={segments} />)
    await userEvent.click(screen.getByRole('button', { name: /交通/ }))
    expect(screen.getByRole('button', { name: /交通/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('donut-center')).toHaveTextContent('交通')
    expect(screen.getByTestId('donut-segment-food')).toHaveAttribute('data-dim', 'true')
    expect(screen.getByTestId('donut-segment-transport')).not.toHaveAttribute('data-dim')
  })

  it('focuses a segment by tapping it, and lets go on a second tap', async () => {
    render(<Donut {...base} segments={segments} />)
    await userEvent.click(screen.getByTestId('donut-segment-lodging'))
    expect(screen.getByTestId('donut-center')).toHaveTextContent('住宿')
    await userEvent.click(screen.getByTestId('donut-segment-lodging'))
    expect(screen.getByTestId('donut-center')).toHaveTextContent('總計')
  })

  it('leaves zero-value segments out of both the ring and the legend', () => {
    render(<Donut {...base} segments={[...segments, { key: 'x', label: '其他', value: 0, colorKey: 'accent9' }]} />)
    expect(screen.queryByTestId('donut-segment-x')).not.toBeInTheDocument()
    expect(screen.queryByText('其他')).not.toBeInTheDocument()
  })

  it('says so when there is nothing to show', () => {
    render(<Donut {...base} segments={[]} />)
    expect(screen.getByText('還沒有支出')).toBeInTheDocument()
    expect(screen.queryAllByTestId(/donut-segment-/)).toHaveLength(0)
  })

  /*
   * 文字永遠用文字色，不用資料色：淺色的 accent（黃、青）當文字在背景上讀不到。
   * 資料色只出現在色塊與色點上，而那兩者是 inline style，所以樣式表裡不該出現任何 accent 槽位。
   */
  it('never colours text with a data colour', () => {
    const css = readFileSync(join(import.meta.dirname, 'Donut.css'), 'utf8')
    expect(css).not.toMatch(/--bi-accent\d/)
  })
})
