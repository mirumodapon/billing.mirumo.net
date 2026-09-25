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
})
