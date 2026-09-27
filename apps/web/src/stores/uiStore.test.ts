import { describe, expect, it } from 'vitest'
import { createUiStore } from './uiStore'

describe('uiStore', () => {
  it('queues snackbars in order', () => {
    const ui = createUiStore()
    ui.getState().show({ message: 'a' })
    ui.getState().show({ message: 'b' })
    expect(ui.getState().queue.map((s) => s.message)).toEqual(['a', 'b'])
  })

  it('dismisses by id', () => {
    const ui = createUiStore()
    const a = ui.getState().show({ message: 'a' })
    ui.getState().show({ message: 'b' })
    ui.getState().dismiss(a)
    expect(ui.getState().queue.map((s) => s.message)).toEqual(['b'])
  })

  // 連刪兩趟旅程：第二則「已刪除」要取代第一則，而不是排在後面等它倒數完
  it('replaces an item shown again with the same id', () => {
    const ui = createUiStore()
    ui.getState().show({ id: 'deleted', message: 'a' })
    ui.getState().show({ id: 'deleted', message: 'b' })
    expect(ui.getState().queue).toEqual([{ id: 'deleted', message: 'b' }])
  })

  it('keeps the position of a replaced item', () => {
    const ui = createUiStore()
    ui.getState().show({ id: 'x', message: 'a' })
    ui.getState().show({ message: 'b' })
    ui.getState().show({ id: 'x', message: 'c' })
    expect(ui.getState().queue.map((s) => s.message)).toEqual(['c', 'b'])
  })
})
