import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { makeTrip } from '../data/testing/fixtures'
import { categoriesFor } from './categories'

const global = defaultSettings().categories

describe('categoriesFor (task#114)', () => {
  it('is the global list when the trip has none of its own', () => {
    expect(categoriesFor(global, makeTrip())).toEqual(global)
  })

  it('adds the trip’s own categories after the global ones, as custom categories', () => {
    const trip = makeTrip({ categories: [{ id: 'ski', name: '滑雪場', icon: 'IconBeach', colorKey: 'accent3' }] })
    const list = categoriesFor(global, trip)
    expect(list.slice(0, global.length)).toEqual(global)
    expect(list.at(-1)).toEqual({ id: 'ski', name: '滑雪場', icon: 'IconBeach', colorKey: 'accent3', builtin: false })
  })

  // 匯入的備份或舊版本可能帶著畫不出來的圖示名稱：退回「其他」的圖示，不能讓畫面壞掉
  it('falls back to a known icon when the saved one is unknown', () => {
    const trip = makeTrip({ categories: [{ id: 'x', name: '謎', icon: 'IconNope', colorKey: 'accent3' }] })
    expect(categoriesFor(global, trip).at(-1)?.icon).toBe('IconDots')
  })
})
