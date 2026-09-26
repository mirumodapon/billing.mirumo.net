import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export interface DragDismissOptions {
  /** 'y' 由上往下拖關閉（sheet），'x' 由左往右拖（swipe action） */
  axis: 'x' | 'y'
  /** 超過這個位移就關閉，單位 px */
  threshold: number
  onDismiss: () => void
}

export interface DragDismissState {
  /** 目前位移，永遠 >= 0。回彈後歸零 */
  offset: number
  dragging: boolean
  handlers: {
    onPointerDown: (event: ReactPointerEvent) => void
    onPointerMove: (event: ReactPointerEvent) => void
    onPointerUp: (event: ReactPointerEvent) => void
    onPointerCancel: (event: ReactPointerEvent) => void
  }
}

/**
 * 超過這個速度就算「甩」，不管拖了多遠都關閉。單位 px/ms。
 *
 * 0.5 約等於一秒滑半個螢幕，是刻意偏保守的值：寧可讓使用者多拖一點，
 * 也不要在他只是想看看底下有什麼的時候把 sheet 關掉。
 */
const FLICK_VELOCITY = 0.5

/**
 * 要算「甩」至少得先走這麼遠。
 *
 * 少了這道門檻，速度判斷會把手指的細微抖動也算進去：5px 走 8ms 就是
 * 0.625 px/ms，遠超過門檻，於是使用者只是碰了一下就把 sheet 關掉。
 * 24px 大約是一次刻意的滑動與一次手抖之間的界線。
 */
const FLICK_MIN_TRAVEL = 24

/**
 * 單軸拖曳關閉。
 *
 * 判斷同時看位移與速度，兩者任一達標就關閉。只看位移的話，快速往下一甩
 * 但距離不夠的動作會被判成回彈——而使用者的意圖明明是關閉，手感的真假
 * 就差在這裡。
 */
export function useDragDismiss({ axis, threshold, onDismiss }: DragDismissOptions): DragDismissState {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef(0)
  const startedAt = useRef(0)
  // 拖曳中的狀態也存一份在 ref 裡：pointermove 可能在 setDragging 觸發的
  // 重繪之前就連續進來好幾次，只看 state 的話那幾次會被當成「沒在拖」而丟掉
  const active = useRef(false)

  const coordOf = (event: ReactPointerEvent) => (axis === 'y' ? event.clientY : event.clientX)

  return {
    offset,
    dragging,
    handlers: {
      onPointerDown(event) {
        start.current = coordOf(event)
        startedAt.current = performance.now()
        active.current = true
        setDragging(true)
      },
      onPointerMove(event) {
        if (!active.current) return
        // 負值代表往開啟的方向拖，夾成 0：跟著走會露出底下的東西，看起來像壞掉
        setOffset(Math.max(0, coordOf(event) - start.current))
      },
      onPointerUp(event) {
        if (!active.current) return
        active.current = false
        setDragging(false)
        const travelled = Math.max(0, coordOf(event) - start.current)
        const elapsed = Math.max(1, performance.now() - startedAt.current)
        const velocity = travelled / elapsed
        const flicked = travelled >= FLICK_MIN_TRAVEL && velocity >= FLICK_VELOCITY
        if (travelled >= threshold || flicked) {
          onDismiss()
          return
        }
        setOffset(0)
      },
      onPointerCancel() {
        // 系統把手勢收走（來電、多指觸控）時一律回彈，不能當成關閉意圖
        active.current = false
        setDragging(false)
        setOffset(0)
      },
    },
  }
}
