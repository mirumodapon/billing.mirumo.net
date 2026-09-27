import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useRef } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, readSession, writeSession } from '../data/session'
import { useScrollRestore } from './useScrollRestore'

function List({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollRestore(ref, ready)
  return <div ref={ref} data-testid="list" />
}

function mount(ready: boolean, route = '/trip/t1/expenses') {
  const ui = (r: boolean) => (
    <StrictMode>
      <MemoryRouter initialEntries={[route]}>
        <List ready={r} />
      </MemoryRouter>
    </StrictMode>
  )
  const result = render(ui(ready))
  return { ...result, setReady: (r: boolean) => result.rerender(ui(r)) }
}

// rAF 換成手動佇列：才能斷言「首次繪製之前不動、之後才還原」
let frames: FrameRequestCallback[] = []
const flushFrames = () => act(() => frames.splice(0).forEach((f) => f(0)))

beforeEach(() => {
  clearSession()
  frames = []
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames[id - 1] = () => {}
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useScrollRestore', () => {
  it('saves the position once scrolling stops', () => {
    vi.useFakeTimers()
    mount(true)
    const list = screen.getByTestId('list')
    list.scrollTop = 300
    fireEvent.scroll(list)
    act(() => vi.advanceTimersByTime(100))
    expect(readSession()?.scrollTop).toBeUndefined()
    act(() => vi.advanceTimersByTime(60))
    expect(readSession()?.scrollTop).toEqual({ '/trip/t1/expenses': 300 })
  })

  it('keeps the positions saved for other routes', () => {
    vi.useFakeTimers()
    writeSession({ route: '/', scrollTop: { '/': 80 } })
    mount(true)
    const list = screen.getByTestId('list')
    list.scrollTop = 300
    fireEvent.scroll(list)
    act(() => vi.advanceTimersByTime(200))
    expect(readSession()?.scrollTop).toEqual({ '/': 80, '/trip/t1/expenses': 300 })
  })

  // 規格 7.9 第 5 步：資料載入且首次繪製之後，才用 rAF 還原
  it('restores the saved position only after the data is ready and a frame has passed', () => {
    writeSession({ route: '/trip/t1/expenses', scrollTop: { '/trip/t1/expenses': 300 } })
    const { setReady } = mount(false)
    const list = screen.getByTestId('list')
    flushFrames()
    expect(list.scrollTop).toBe(0)
    setReady(true)
    expect(list.scrollTop).toBe(0)
    flushFrames()
    expect(list.scrollTop).toBe(300)
  })

  // 使用者已經捲到別處後資料重載，不能把他拉回去
  it('restores only once', () => {
    writeSession({ route: '/trip/t1/expenses', scrollTop: { '/trip/t1/expenses': 300 } })
    const { setReady } = mount(true)
    const list = screen.getByTestId('list')
    flushFrames()
    // 掛載時就已經 ready（資料早就在 store 裡）：StrictMode 會把 effect 跑兩次，仍要還原
    expect(list.scrollTop).toBe(300)
    list.scrollTop = 40
    setReady(false)
    setReady(true)
    flushFrames()
    expect(list.scrollTop).toBe(40)
  })
})
