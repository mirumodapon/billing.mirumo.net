import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  // 骨架屏對螢幕閱讀器沒有意義，被念出來只會製造噪音
  it('is hidden from assistive tech', () => {
    render(<Skeleton />)
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws one line by default', () => {
    render(<Skeleton />)
    expect(screen.getAllByTestId('skeleton-line')).toHaveLength(1)
  })

  it('draws the requested number of lines', () => {
    render(<Skeleton lines={3} />)
    expect(screen.getAllByTestId('skeleton-line')).toHaveLength(3)
  })

  // lines 只對文字骨架有意義；圓形畫三個會很奇怪
  it('ignores lines for non-text variants', () => {
    render(<Skeleton variant="circle" lines={3} />)
    expect(screen.getAllByTestId('skeleton-line')).toHaveLength(1)
  })

  it('applies explicit dimensions', () => {
    render(<Skeleton variant="rect" width="120px" height="40px" />)
    expect(screen.getByTestId('skeleton-line')).toHaveStyle({ width: '120px', height: '40px' })
  })

  /*
   * 整組變體樣式都掛在這個屬性上。少了它，[data-variant='circle'] 之類的
   * 規則全部落空，圓形骨架會靜靜變成一條文字線——沒有任何錯誤，只是長錯。
   */
  it('marks the variant for the stylesheet to shape', () => {
    const { rerender } = render(<Skeleton variant="circle" />)
    expect(screen.getByTestId('skeleton')).toHaveAttribute('data-variant', 'circle')
    rerender(<Skeleton variant="rect" />)
    expect(screen.getByTestId('skeleton')).toHaveAttribute('data-variant', 'rect')
    rerender(<Skeleton />)
    expect(screen.getByTestId('skeleton')).toHaveAttribute('data-variant', 'text')
  })

  /*
   * 上面只證明屬性標對了。CSS 沒載進 jsdom，所以「三個變體各自有對應規則」
   * 這一半只能讀原始碼——證明選擇器在，不證明瀏覽器畫出來的形狀對。
   */
  it('gives every variant its own rule', () => {
    const css = readFileSync(join(import.meta.dirname, 'Skeleton.css'), 'utf8')
    for (const v of ['text', 'circle', 'rect']) {
      expect(css, `Skeleton.css has no rule for ${v}`).toContain(`[data-variant='${v}']`)
    }
  })

  // 呼叫端算出 lines={0} 時（例如照清單長度給值）不能畫出一個空骨架：
  // 那會是一塊看不見的載入狀態
  it('still draws a line when asked for none', () => {
    render(<Skeleton lines={0} />)
    expect(screen.getAllByTestId('skeleton-line')).toHaveLength(1)
  })
})
