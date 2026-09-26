import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

function Harness({ onEscape }: { onEscape?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useFocusTrap<HTMLDivElement>(open, onEscape)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        開啟
      </button>
      {open && (
        <div ref={ref}>
          <button type="button">第一</button>
          <button type="button">第二</button>
        </div>
      )}
    </div>
  )
}

describe('useFocusTrap', () => {
  it('moves focus into the trap when it opens', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: '開啟' }))
    expect(screen.getByRole('button', { name: '第一' })).toHaveFocus()
  })

  // 循環回第一個，而不是跑到 overlay 後面的頁面去
  it('wraps Tab from the last element back to the first', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: '開啟' }))
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '第二' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '第一' })).toHaveFocus()
  })

  it('wraps Shift+Tab from the first element to the last', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: '開啟' }))
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: '第二' })).toHaveFocus()
  })

  it('calls onEscape when Escape is pressed', async () => {
    const onEscape = vi.fn()
    render(<Harness onEscape={onEscape} />)
    await userEvent.click(screen.getByRole('button', { name: '開啟' }))
    await userEvent.keyboard('{Escape}')
    expect(onEscape).toHaveBeenCalledOnce()
  })

  /*
   * 關閉後焦點要回到當初開啟它的按鈕。少了這個，鍵盤使用者關掉 sheet 之後
   * 焦點會掉回 body，得從頁面最上面重新 Tab 一遍。
   */
  it('returns focus to whatever had it before', async () => {
    function Closable() {
      const [open, setOpen] = useState(false)
      const ref = useFocusTrap<HTMLDivElement>(open)
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            開啟
          </button>
          {open && (
            <div ref={ref}>
              <button type="button" onClick={() => setOpen(false)}>
                關閉
              </button>
            </div>
          )}
        </div>
      )
    }
    render(<Closable />)
    const opener = screen.getByRole('button', { name: '開啟' })
    await userEvent.click(opener)
    await userEvent.click(screen.getByRole('button', { name: '關閉' }))
    expect(opener).toHaveFocus()
  })

  it('does nothing while inactive', async () => {
    const onEscape = vi.fn()
    render(<Harness onEscape={onEscape} />)
    await userEvent.keyboard('{Escape}')
    expect(onEscape).not.toHaveBeenCalled()
  })

  /*
   * 上面那條在 Harness 裡是靠「容器還沒渲染、ref 是 null」才成立的，所以
   * 它測不出 active 這個旗標本身有沒有被看。把容器常駐掛著（為了動畫而
   * 保留 DOM 是很自然的做法），停用中的陷阱就不該把焦點搶走。
   */
  it('leaves focus alone when inactive even if the container is mounted', () => {
    function AlwaysMounted() {
      const ref = useFocusTrap<HTMLDivElement>(false)
      return (
        <div>
          <button type="button">外面</button>
          <div ref={ref}>
            <button type="button">裡面</button>
          </div>
        </div>
      )
    }
    render(<AlwaysMounted />)
    expect(screen.getByRole('button', { name: '裡面' })).not.toHaveFocus()
    expect(document.body).toHaveFocus()
  })

  /*
   * inert 的子樹依規範不可聚焦，但 querySelectorAll 照樣選得到它們。
   * 留在循環裡的話 focus() 會靜默失敗、焦點原地不動——Tab 看起來像壞掉，
   * 而且沒有任何錯誤。Accordion 收折時正是用 inert，且會被放進 Sheet。
   */
  it('skips focusables inside an inert subtree', () => {
    function WithInert() {
      const ref = useFocusTrap<HTMLDivElement>(true)
      return (
        <div ref={ref}>
          <div inert>
            <button type="button">收折起來的</button>
          </div>
          <button type="button">看得見的</button>
        </div>
      )
    }
    render(<WithInert />)
    expect(screen.getByRole('button', { name: '看得見的' })).toHaveFocus()
  })

  // display:none 的元素同理：選得到，但聚焦上去等於焦點消失
  it('skips focusables that are not displayed', () => {
    function WithHidden() {
      const ref = useFocusTrap<HTMLDivElement>(true)
      return (
        <div ref={ref}>
          <button type="button" style={{ display: 'none' }}>
            藏起來的
          </button>
          <button type="button">看得見的</button>
        </div>
      )
    }
    render(<WithHidden />)
    expect(screen.getByRole('button', { name: '看得見的' })).toHaveFocus()
  })
})
