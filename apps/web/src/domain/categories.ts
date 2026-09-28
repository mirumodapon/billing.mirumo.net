import type { Trip } from '@billing/core'
import { CATEGORY_ICONS, type CategoryIconName } from '@billing/ui'
import type { Category } from '../data/types'

const isIconName = (name: string): name is CategoryIconName => name in CATEGORY_ICONS

/**
 * 這趟旅程能用的類別：全域的，加上只用於這趟旅程的（task#114，與 task#92 的付款方式同一個做法）。
 * 旅程專用的一律當成自訂類別：名稱是使用者輸入的字面值，不翻譯。
 */
export function categoriesFor(global: readonly Category[], trip: Pick<Trip, 'categories'>): Category[] {
  return [
    ...global,
    ...(trip.categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      // 備份或舊版本帶來的圖示名稱可能已經不在清單裡：畫不出來就用「其他」的圖示
      icon: isIconName(c.icon) ? c.icon : ('IconDots' as CategoryIconName),
      colorKey: c.colorKey,
      builtin: false,
    })),
  ]
}
