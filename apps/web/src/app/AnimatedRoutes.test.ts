import { describe, expect, it } from 'vitest'
import { directionBetween, pageKeyOf } from './AnimatedRoutes'

describe('pageKeyOf', () => {
  it('treats the tabs of a trip as one page and each form as its own', () => {
    expect(pageKeyOf('/trip/t1/stats')).toBe('/trip/t1')
    expect(pageKeyOf('/trip/t1/setup')).toBe('/trip/t1')
    expect(pageKeyOf('/trip/t1/expense/new')).toBe('/trip/t1/expense/new')
    expect(pageKeyOf('/trip/t1/expense/e9')).toBe('/trip/t1/expense/e9')
    expect(pageKeyOf('/settings')).toBe('/settings')
    expect(pageKeyOf('/')).toBe('/')
  })
})

describe('directionBetween', () => {
  // 規格 4.1：全螢幕表單由下往上推入
  it('pushes a form up and drops it back down', () => {
    expect(directionBetween('/trip/t1', '/trip/t1/expense/new')).toBe('up')
    expect(directionBetween('/trip/t1/expense/new', '/trip/t1')).toBe('down')
  })

  // 規格 5.5：往深處由右滑入，回來由左滑回
  it('slides sideways between the list, settings and a trip', () => {
    expect(directionBetween('/', '/trip/t1')).toBe('forward')
    expect(directionBetween('/trip/t1', '/')).toBe('back')
    expect(directionBetween('/', '/settings')).toBe('forward')
  })
})
