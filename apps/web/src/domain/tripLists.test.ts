import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { makeTrip } from '../data/testing/fixtures'
import { t } from '../i18n'
import { categoriesFor } from './categories'
import { paymentMethodsFor, tripMethodName } from './paymentMethods'
import { withOwnLists } from './tripLists'

const settings = defaultSettings()

describe('withOwnLists (task#120)', () => {
  // 建立旅程時複製一份完整清單：內建項目照樣帶著 builtin，名稱仍隨語系翻譯
  it('copies the global categories and payment methods into the trip', () => {
    const trip = withOwnLists(makeTrip(), settings)
    expect(trip.ownLists).toBe(true)
    expect(trip.categories?.map((c) => c.id)).toEqual(settings.categories.map((c) => c.id))
    expect(trip.paymentMethods?.map((m) => m.id)).toEqual(settings.paymentMethods.map((m) => m.id))
    expect(trip.categories?.[0]).toMatchObject({ id: 'cat.food', builtin: true })
  })

  // 舊旅程已經有專用項目：複製時接在全域清單後面，一個都不能掉
  it('keeps an older trip’s own items after the global ones', () => {
    const older = makeTrip({ paymentMethods: [{ id: 'suica', name: 'Suica', storedValue: { currency: 'JPY' } }] })
    const trip = withOwnLists(older, settings)
    expect(trip.paymentMethods?.map((m) => m.id)).toEqual(['pay.cash', 'pay.credit', 'pay.mobile', 'suica'])
    expect(trip.paymentMethods?.at(-1)).toEqual({ id: 'suica', name: 'Suica', storedValue: { currency: 'JPY' } })
  })

  it('leaves a trip that already has its own lists as it is', () => {
    const own = withOwnLists(makeTrip(), settings)
    const trimmed = { ...own, categories: own.categories!.slice(0, 1) }
    expect(withOwnLists(trimmed, settings)).toBe(trimmed)
  })
})

describe('lists of a trip with its own copy (task#120)', () => {
  it('uses only the trip’s lists, whatever the global settings say now', () => {
    const own = withOwnLists(makeTrip(), settings)
    const trip = { ...own, categories: own.categories!.filter((c) => c.id !== 'cat.ticket') }
    const laterGlobal = [...settings.categories, { id: 'new', name: '新的', icon: 'IconGift' as const, colorKey: 'accent3' as const, builtin: false }]
    expect(categoriesFor(laterGlobal, trip).map((c) => c.id)).not.toContain('cat.ticket')
    expect(categoriesFor(laterGlobal, trip).map((c) => c.id)).not.toContain('new')
    expect(paymentMethodsFor([], own).map((m) => m.id)).toEqual(['pay.cash', 'pay.credit', 'pay.mobile'])
  })

  it('names built-in items in the current language and custom ones as typed', () => {
    expect(tripMethodName({ id: 'pay.cash', builtin: true })).toBe(t('pay.cash'))
    expect(tripMethodName({ id: 'suica', name: 'Suica' })).toBe('Suica')
  })
})
