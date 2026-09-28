import type { Trip, TripCategory, TripPaymentMethod } from '@billing/core'
import type { AppSettings } from '../data/types'
import { categoriesFor } from './categories'
import { paymentMethodsFor } from './paymentMethods'

/**
 * 讓旅程擁有自己一份完整的類別與付款方式清單（task#120）。
 *
 * 建立旅程時從全域設定複製；之後在旅程設定裡增刪改都只影響這一趟，全域設定只是新旅程的範本。
 * 舊旅程沒有自己的清單（沿用全域 + 專用項目），第一次在旅程設定裡動清單時才複製：
 * 那時看到的是什麼，複製下來就是什麼，旅程專用項目一個都不會掉。已經有的直接原樣回傳。
 */
export function withOwnLists(trip: Trip, settings: Pick<AppSettings, 'categories' | 'paymentMethods'>): Trip {
  if (trip.ownLists) return trip
  const ownCategories = new Map((trip.categories ?? []).map((c) => [c.id, c]))
  const ownMethods = new Map((trip.paymentMethods ?? []).map((m) => [m.id, m]))
  const categories: TripCategory[] = categoriesFor(settings.categories, trip).map(
    (c) => ownCategories.get(c.id) ?? (c.builtin ? { id: c.id, builtin: true, icon: c.icon, colorKey: c.colorKey } : { id: c.id, name: c.name ?? c.id, icon: c.icon, colorKey: c.colorKey }),
  )
  const paymentMethods: TripPaymentMethod[] = paymentMethodsFor(settings.paymentMethods, trip).map(
    (m) => ownMethods.get(m.id) ?? (m.builtin ? { id: m.id, builtin: true } : { id: m.id, name: m.name ?? m.id }),
  )
  return { ...trip, ownLists: true, categories, paymentMethods }
}
