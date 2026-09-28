import type { Trip, TripCategory } from '@billing/core'
import { CATEGORY_ICONS, type CategoryIconName } from '@billing/ui'
import { IconDots, IconQuestionMark, IconWallet, type TablerIcon } from '@tabler/icons-react'
import type { Category } from '../data/types'
import { t } from '../i18n'
import { displayName } from './names'

const isIconName = (name: string): name is CategoryIconName => name in CATEGORY_ICONS

/** 沒選類別（task#127）：類別可以留空，存成空字串 */
export const NO_CATEGORY = ''

/**
 * 一筆支出的類別圖示：儲值固定是錢包（task#142，儲值不選類別）；沒選類別的是問號（task#127）；
 * 引用的類別已經不在清單裡（例如刪掉了）的沿用「其他」的點點
 */
export function categoryGlyph(category: Category | undefined, categoryId: string, topUp = false): TablerIcon {
  if (topUp) return IconWallet
  if (category) return CATEGORY_ICONS[category.icon]
  return categoryId === NO_CATEGORY ? IconQuestionMark : IconDots
}

/** 一筆支出的類別名稱：儲值叫「儲值」，沒選的叫「未分類」，找不到的顯示原本的 id */
export function categoryLabel(category: Category | undefined, categoryId: string, topUp = false): string {
  if (topUp) return t('cat.topUp')
  if (category) return displayName(category)
  return categoryId === NO_CATEGORY ? t('cat.none') : categoryId
}

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
