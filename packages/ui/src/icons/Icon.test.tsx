import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IconPlus } from '@tabler/icons-react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from './Icon'

describe('Icon', () => {
  // 純裝飾的圖示被念出來只是噪音，旁邊通常已經有文字
  it('is hidden from assistive tech by default', () => {
    render(<Icon glyph={IconPlus} data-testid="i" />)
    expect(screen.getByTestId('i')).toHaveAttribute('aria-hidden', 'true')
  })

  // 只有圖示沒有文字的按鈕，圖示就是唯一的語意來源
  it('becomes an img with a name when given a label', () => {
    render(<Icon glyph={IconPlus} ariaLabel="新增支出" />)
    expect(screen.getByRole('img', { name: '新增支出' })).toBeInTheDocument()
  })

  it('has no aria-hidden once it is labelled', () => {
    render(<Icon glyph={IconPlus} ariaLabel="新增支出" />)
    expect(screen.getByRole('img')).not.toHaveAttribute('aria-hidden')
  })

  it('applies the size', () => {
    render(<Icon glyph={IconPlus} size="lg" data-testid="i" />)
    expect(screen.getByTestId('i')).toHaveAttribute('data-size', 'lg')
  })

  // 顏色靠繼承，圖示才能跟著所在按鈕的狀態變，不必逐處指定
  it('inherits colour rather than setting its own', () => {
    const css = readFileSync(join(import.meta.dirname, 'Icon.css'), 'utf8')
    expect(css).toMatch(/\.bi-icon\s*{[^}]*color:\s*inherit/)
  })

  /*
   * data-size 那條只證明屬性標對了，證明不了畫出來的大小。把尺寸對應表
   * 全部改成 16 之後所有測試照樣綠——而 size 這個 prop 的全部意義就是
   * 畫成不同大小，等於它真正的效果沒有任何人守。
   *
   * Tabler 的圖示把 size 渲染成 SVG 的 width/height，所以這裡量得到。
   */
  it('renders each size at its own pixel size', () => {
    const seen = new Map<string, string | null>()
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { unmount } = render(<Icon glyph={IconPlus} size={size} data-testid={size} />)
      seen.set(size, screen.getByTestId(size).getAttribute('width'))
      unmount()
    }
    expect(seen.get('sm')).toBe('16')
    expect(seen.get('md')).toBe('20')
    expect(seen.get('lg')).toBe('24')
  })

  /*
   * 線寬是刻意選的：Tabler 預設 2 在小尺寸下偏重，整個 app 的圖示會看起來
   * 比文字黑。拿掉這個設定不會有任何東西報錯，只會每個圖示都變粗一階。
   */
  it('sets its own stroke width rather than taking the library default', () => {
    render(<Icon glyph={IconPlus} data-testid="i" />)
    expect(screen.getByTestId('i')).toHaveAttribute('stroke-width', '1.75')
  })
})
