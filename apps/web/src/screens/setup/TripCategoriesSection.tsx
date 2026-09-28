import type { Expense, Trip, TripCategory } from '@billing/core'
import { Accordion, Button, CATEGORY_ICONS, Icon } from '@billing/ui'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import type { Category } from '../../data/types'
import { categoriesFor } from '../../domain/categories'
import { displayName } from '../../domain/names'
import { withOwnLists } from '../../domain/tripLists'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useTrips } from '../../stores/StoresProvider'
import { useConfirmDelete } from '../forms/useConfirmDelete'
import { CategoryEditSheet } from '../settings/CategoryEditSheet'

export interface TripCategoriesSectionProps {
  trip: Trip
  open: boolean
  onToggle: () => void
  save: (change: (t: Trip) => Trip) => Promise<Trip | undefined>
}

// selector 每次回新的 [] 會讓 useSyncExternalStore 無限重繪（見 TripPaymentMethodsSection）
const NO_EXPENSES: Expense[] = []

/**
 * 這趟旅程的類別（task#114；task#120 起是完整的一份，建立旅程時從設定複製）。
 * 新增與編輯沿用設定頁的類別編輯 sheet：名稱、圖示、顏色；內建的只能改圖示與顏色。
 * 這趟旅程還有支出在用的不能刪。改的永遠是旅程自己那一份，全域設定不受影響。
 */
export function TripCategoriesSection({ trip, open, onToggle, save }: TripCategoriesSectionProps) {
  const { t, tPlural } = useI18n()
  const expenses = useTrips((s) => (s.current?.tripId === trip.id ? s.current.expenses : NO_EXPENSES))
  const settings = useSettings((s) => s.settings)
  // 舊旅程還沒有自己的一份時，這裡看到的是複製後會得到的樣子
  const categories = categoriesFor([], withOwnLists(trip, settings))
  const [editing, setEditing] = useState<{ category?: Category } | null>(null)
  const confirm = useConfirmDelete()

  const update = (change: (list: TripCategory[]) => TripCategory[]) =>
    void save((x) => {
      const own = withOwnLists(x, settings)
      return { ...own, categories: change(own.categories ?? []) }
    })
  const store = (category: Category) => {
    setEditing(null)
    const entry: TripCategory = category.builtin
      ? { id: category.id, builtin: true, icon: category.icon, colorKey: category.colorKey }
      : { id: category.id, name: category.name ?? '', icon: category.icon, colorKey: category.colorKey }
    update((list) => (list.some((c) => c.id === entry.id) ? list.map((c) => (c.id === entry.id ? entry : c)) : [...list, entry]))
  }

  return (
    <Accordion
      title={t('tripCategories.title')}
      summary={categories.length === 0 ? t('tripMethods.none') : categories.map(displayName).join('・')}
      open={open}
      onToggle={onToggle}
      data-testid="section-trip-categories"
    >
      <div className="app-form">
        <p className="app-field-label m-0">{t('tripCategories.hint')}</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {categories.map((category) => {
            const used = expenses.filter((e) => !e.deletedAt && e.categoryId === category.id).length
            const name = displayName(category)
            return (
              <li key={category.id} className="app-row app-row--split">
                <button type="button" className="app-row__main" onClick={() => setEditing({ category })}>
                  <span className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: `var(--bi-${category.colorKey})`, color: `var(--bi-${category.colorKey}-fg)` }}
                    >
                      <Icon glyph={CATEGORY_ICONS[category.icon]} />
                    </span>
                    {name}
                  </span>
                  <span className="app-row__value">{used > 0 ? tPlural('settings.usedBy', { count: used }) : null}</span>
                </button>
                {used === 0 ? (
                  <Button
                    variant="ghost"
                    aria-label={t('settings.removeItem', { name })}
                    onClick={() => confirm.ask(name, 'permanent', () => update((list) => list.filter((c) => c.id !== category.id)))}
                  >
                    <Icon glyph={IconTrash} />
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
        <Button variant="secondary" onClick={() => setEditing({})}>
          {t('settings.addCategory')}
        </Button>
        <CategoryEditSheet
          open={editing !== null}
          category={editing?.category}
          // 顏色避開這趟旅程已經用掉的
          usedColors={categories.map((c) => c.colorKey)}
          onSave={store}
          onClose={() => setEditing(null)}
        />
        {confirm.dialog}
      </div>
    </Accordion>
  )
}
