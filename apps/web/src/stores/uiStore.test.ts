import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, readSession, writeSession } from '../data/session'
import { EMPTY_FILTER } from '../domain/expenseFilter'
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

describe('uiStore: expense filters (task#106)', () => {
  // 點進一筆再回來列表會重新掛載：篩選要留在 store，不能跟著元件消失
  it('keeps a filter per trip', () => {
    const ui = createUiStore()
    ui.getState().setExpenseFilter('t1', { ...EMPTY_FILTER, payers: ['a'] })
    expect(ui.getState().expenseFilters.t1?.payers).toEqual(['a'])
    expect(ui.getState().expenseFilters.t2).toBeUndefined()
  })
})

describe('uiStore: expense filters in the session (task#91, spec 7.9)', () => {
  beforeEach(() => clearSession())

  it('writes the filter to the session and brings it back in a new store', () => {
    writeSession({ route: '/trip/t1/expenses', tripId: 't1' })
    createUiStore().getState().setExpenseFilter('t1', { ...EMPTY_FILTER, payers: ['b'] })
    expect(readSession()).toMatchObject({ route: '/trip/t1/expenses', filters: { tripId: 't1', payers: ['b'] } })
    expect(createUiStore().getState().expenseFilters).toEqual({ t1: { ...EMPTY_FILTER, payers: ['b'] } })
  })

  it('drops the filter from the session once it is cleared', () => {
    const ui = createUiStore()
    ui.getState().setExpenseFilter('t1', { ...EMPTY_FILTER, draftsOnly: true })
    ui.getState().setExpenseFilter('t1', EMPTY_FILTER)
    expect(readSession()).not.toHaveProperty('filters')
  })
})
