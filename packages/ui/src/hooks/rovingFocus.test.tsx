import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { nextIndex, useRovingFocus } from './rovingFocus'

describe('nextIndex', () => {
  it('moves forward and backward with the arrow keys', () => {
    expect(nextIndex(1, 'ArrowRight', 4)).toBe(2)
    expect(nextIndex(1, 'ArrowDown', 4)).toBe(2)
    expect(nextIndex(1, 'ArrowLeft', 4)).toBe(0)
    expect(nextIndex(1, 'ArrowUp', 4)).toBe(0)
  })

  it('wraps at both ends', () => {
    expect(nextIndex(3, 'ArrowRight', 4)).toBe(0)
    expect(nextIndex(0, 'ArrowLeft', 4)).toBe(3)
  })

  it('jumps to the ends with Home and End', () => {
    expect(nextIndex(2, 'Home', 4)).toBe(0)
    expect(nextIndex(1, 'End', 4)).toBe(3)
  })

  it('ignores keys it does not own', () => {
    expect(nextIndex(1, 'Tab', 4)).toBeNull()
    expect(nextIndex(1, 'a', 4)).toBeNull()
  })

  it('returns null for an empty group', () => {
    expect(nextIndex(0, 'ArrowRight', 0)).toBeNull()
  })

  // 選中的值不在清單裡（index -1）時，從第一個開始走，而不是變成 -2 之類的怪值
  it('treats a missing current index as the first item', () => {
    expect(nextIndex(-1, 'ArrowRight', 4)).toBe(1)
  })

  /*
   * 格狀排列時上下鍵跳一整列。到底時停住不繞：上下繞回會從最後一列跳到第一列
   * 的同一欄，視覺上像瞬移，而左右繞回是一維清單的常規，使用者預期得到。
   */
  describe('in a grid', () => {
    it('moves a whole row with up and down', () => {
      expect(nextIndex(1, 'ArrowDown', 12, 6)).toBe(7)
      expect(nextIndex(7, 'ArrowUp', 12, 6)).toBe(1)
    })

    it('stops at the top and bottom rows instead of wrapping', () => {
      expect(nextIndex(2, 'ArrowUp', 12, 6)).toBe(2)
      expect(nextIndex(9, 'ArrowDown', 12, 6)).toBe(9)
    })

    // 最後一列不滿時，往下不能跳到不存在的格子
    it('does not step past the last item on a short final row', () => {
      expect(nextIndex(4, 'ArrowDown', 8, 6)).toBe(4)
      expect(nextIndex(1, 'ArrowDown', 8, 6)).toBe(7)
    })

    it('still moves one step with left and right', () => {
      expect(nextIndex(5, 'ArrowRight', 12, 6)).toBe(6)
    })
  })
})

function Group() {
  const values = ['a', 'b', 'c'] as const
  const [value, setValue] = useState<(typeof values)[number]>('a')
  const { onKeyDown, itemProps } = useRovingFocus({ values, value, onChange: setValue })
  return (
    <div role="radiogroup" aria-label="g" onKeyDown={onKeyDown}>
      {values.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} {...itemProps(v)}>
          {v}
        </button>
      ))}
    </div>
  )
}

describe('useRovingFocus', () => {
  it('keeps only the selected item in the tab order', () => {
    render(<Group />)
    expect(screen.getByRole('radio', { name: 'a' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'b' })).toHaveAttribute('tabindex', '-1')
  })

  it('selects the next item on an arrow key', async () => {
    render(<Group />)
    screen.getByRole('radio', { name: 'a' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'b' })).toHaveAttribute('aria-checked', 'true')
  })

  /*
   * 這條是這個 hook 存在的主要理由。只改選取不移焦點的話，焦點框留在舊的
   * 那一個上，螢幕閱讀器念的也是舊的——TabBar 在 Plan 3 就是這樣出錯的。
   */
  it('moves keyboard focus along with the selection', async () => {
    render(<Group />)
    screen.getByRole('radio', { name: 'a' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'b' })).toHaveFocus()
  })
})
