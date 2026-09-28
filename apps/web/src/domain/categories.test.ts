import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { makeTrip } from '../data/testing/fixtures'
import { IconDots, IconQuestionMark, IconWallet } from '@tabler/icons-react'
import { t } from '../i18n'
import { categoriesFor, categoryGlyph, categoryLabel, NO_CATEGORY } from './categories'

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

// task#127：類別可以留空
describe('an expense without a category', () => {
  const food = global.find((c) => c.id === 'cat.food')!
  it('shows a question mark and is called uncategorised', () => {
    expect(categoryGlyph(undefined, NO_CATEGORY)).toBe(IconQuestionMark)
    expect(categoryLabel(undefined, NO_CATEGORY)).toBe(t('cat.none'))
  })

  it('keeps the dots and the raw id for a category that is no longer in the list', () => {
    expect(categoryGlyph(undefined, 'cat.gone')).toBe(IconDots)
    expect(categoryLabel(undefined, 'cat.gone')).toBe('cat.gone')
  })

  it('uses the category’s own icon and name when there is one', () => {
    expect(categoryGlyph(food, food.id)).not.toBe(IconQuestionMark)
    expect(categoryLabel(food, food.id)).toBe(t('cat.food'))
  })
})

// task#142：儲值不選類別，固定顯示錢包與「儲值」
describe('a top-up', () => {
  it('shows a wallet and is called a top-up, whatever its category id', () => {
    expect(categoryGlyph(undefined, NO_CATEGORY, true)).toBe(IconWallet)
    expect(categoryLabel(undefined, NO_CATEGORY, true)).toBe(t('cat.topUp'))
  })
})
