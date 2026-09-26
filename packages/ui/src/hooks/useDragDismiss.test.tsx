import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDragDismiss } from './useDragDismiss'

function Harness({ onDismiss, axis = 'y' }: { onDismiss: () => void; axis?: 'x' | 'y' }) {
  const { offset, dragging, handlers } = useDragDismiss({ axis, threshold: 80, onDismiss })
  return (
    <div
      data-testid="target"
      data-dragging={dragging || undefined}
      data-offset={offset}
      {...handlers}
    >
      內容
    </div>
  )
}

/** jsdom 的 PointerEvent 不帶座標，所以自己組 */
function pointer(el: Element, type: string, coords: { clientX?: number; clientY?: number }) {
  fireEvent(el, Object.assign(new Event(type, { bubbles: true }), { pointerId: 1, ...coords }))
}

/**
 * 一個由測試自己推進的時鐘。
 *
 * 非做不可：jsdom 裡三個事件是同一個 tick 連發的，真實的 performance.now
 * 幾乎不前進，於是每一次拖曳都會被算成速度極高的甩，「距離不夠要回彈」
 * 那條測試會因此失敗——而那不是實作的問題，是測試環境沒有時間流逝。
 *
 * 用可推進的時鐘而不是 mockReturnValueOnce：React 自己也會呼叫
 * performance.now，排好的值會被它先吃掉，結果取決於 React 內部呼叫幾次。
 */
function clock() {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  return {
    advance(ms: number) {
      now += ms
    },
  }
}

afterEach(() => vi.restoreAllMocks())

describe('useDragDismiss', () => {
  it('tracks the offset while dragging', () => {
    render(<Harness onDismiss={vi.fn()} />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointerdown', { clientY: 0 })
    pointer(el, 'pointermove', { clientY: 40 })
    expect(el).toHaveAttribute('data-offset', '40')
    expect(el).toHaveAttribute('data-dragging', 'true')
  })

  // 只能往關閉的方向拖。往回拖會露出底下的東西，看起來像壞掉
  it('does not follow a drag in the opening direction', () => {
    render(<Harness onDismiss={vi.fn()} />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointerdown', { clientY: 0 })
    pointer(el, 'pointermove', { clientY: -60 })
    expect(el).toHaveAttribute('data-offset', '0')
  })

  it('dismisses once the drag passes the threshold', () => {
    const onDismiss = vi.fn()
    // 推進得夠慢，速度完全不可能達標，確定是距離在決定
    const t = clock()
    render(<Harness onDismiss={onDismiss} />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointerdown', { clientY: 0 })
    pointer(el, 'pointermove', { clientY: 100 })
    t.advance(2000)
    pointer(el, 'pointerup', { clientY: 100 })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('springs back when the drag falls short', () => {
    const onDismiss = vi.fn()
    const t = clock()
    render(<Harness onDismiss={onDismiss} />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointerdown', { clientY: 0 })
    pointer(el, 'pointermove', { clientY: 30 })
    t.advance(2000)
    pointer(el, 'pointerup', { clientY: 30 })
    expect(onDismiss).not.toHaveBeenCalled()
    expect(el).toHaveAttribute('data-offset', '0')
  })

  /*
   * 這條是整個 hook 存在的理由。只看位移的話，快速往下一甩但距離不夠的
   * 動作會被判成回彈，而使用者的意圖明明是關閉——手感的真假就差在這裡。
   * 距離與上一條完全相同，差別只有時間。
   */
  it('dismisses a short but fast flick', () => {
    const onDismiss = vi.fn()
    const t = clock()
    render(<Harness onDismiss={onDismiss} />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointerdown', { clientY: 0 })
    pointer(el, 'pointermove', { clientY: 30 })
    t.advance(20)
    pointer(el, 'pointerup', { clientY: 30 })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  /*
   * 速度判斷若沒有最小距離，手指一個細微抖動就會關掉 sheet：5px 走 8ms
   * 是 0.625 px/ms，遠超過速度門檻。使用者只是碰了一下，畫面就消失了。
   */
  it('ignores a fast twitch that barely moved', () => {
    const onDismiss = vi.fn()
    const t = clock()
    render(<Harness onDismiss={onDismiss} />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointerdown', { clientY: 0 })
    pointer(el, 'pointermove', { clientY: 5 })
    t.advance(8)
    pointer(el, 'pointerup', { clientY: 5 })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  /*
   * 系統把手勢收走（來電、切換 app、第二根手指按下）時一律回彈。
   * 當成關閉意圖的話，使用者接完電話回來會發現東西不見了。
   */
  it('springs back when the system takes the gesture away', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointerdown', { clientY: 0 })
    pointer(el, 'pointermove', { clientY: 100 })
    pointer(el, 'pointercancel', { clientY: 100 })
    expect(onDismiss).not.toHaveBeenCalled()
    expect(el).toHaveAttribute('data-offset', '0')
  })

  it('works on the horizontal axis too', () => {
    const onDismiss = vi.fn()
    const t = clock()
    render(<Harness onDismiss={onDismiss} axis="x" />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointerdown', { clientX: 0 })
    pointer(el, 'pointermove', { clientX: 100 })
    t.advance(2000)
    pointer(el, 'pointerup', { clientX: 100 })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  /*
   * 剛好拖到門檻就要關閉。沒有這條的話 >= 換成 > 一條測試都不會紅——
   * 其他 fixture 不是 30 就是 100，永遠踩不到邊界。差別只有一個像素，
   * 但那一個像素是呼叫端讀 threshold 這個名字時預期的行為。
   */
  it('dismisses at exactly the threshold, not one pixel past it', () => {
    const onDismiss = vi.fn()
    const t = clock()
    render(<Harness onDismiss={onDismiss} />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointerdown', { clientY: 0 })
    pointer(el, 'pointermove', { clientY: 80 })
    t.advance(2000)
    pointer(el, 'pointerup', { clientY: 80 })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  // 沒按下就移動（例如手指從別處滑進來）不該被當成拖曳
  it('ignores movement that did not start with a press', () => {
    render(<Harness onDismiss={vi.fn()} />)
    const el = screen.getByTestId('target')
    pointer(el, 'pointermove', { clientY: 100 })
    expect(el).toHaveAttribute('data-offset', '0')
  })
})
