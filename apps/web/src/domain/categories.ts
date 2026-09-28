import type { Trip, TripCategory } from '@billing/core'
import { CATEGORY_ICONS, type CategoryIconName } from '@billing/ui'
import type { Category } from '../data/types'

const isIconName = (name: string): name is CategoryIconName => name in CATEGORY_ICONS

/** 旅程清單裡的一個類別轉成 app 的 Category。備份或舊版本帶來的圖示名稱可能已經不在清單裡：畫不出來就用「其他」的圖示 */
export function asCategory(c: TripCategory): Category {
  const icon = isIconName(c.icon) ? c.icon : ('IconDots' as CategoryIconName)
  return c.builtin ? { id: c.id, icon, colorKey: c.colorKey, builtin: true } : { id: c.id, name: c.name ?? c.id, icon, colorKey: c.colorKey, builtin: false }
}

/**
 * 這趟旅程能用的類別。
 *
 * 有自己一份清單的旅程（task#120，建立時從全域複製）只用它自己的；舊旅程沿用全域的，
 * 加上只用於這趟旅程的（task#114，與 task#92 的付款方式同一個做法）。
 */
export function categoriesFor(global: readonly Category[], trip: Pick<Trip, 'categories' | 'ownLists'>): Category[] {
  const own = (trip.categories ?? []).map(asCategory)
  return trip.ownLists ? own : [...global, ...own]
}
