import type { Expense, Trip, TripCategory } from '@billing/core'
import { Accordion, Button, CATEGORY_ICONS, Icon } from '@billing/ui'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import type { Category } from '../../data/types'
import { categoriesFor } from '../../domain/categories'
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
 * 只用於這趟旅程的類別（task#114），與旅程專用付款方式（task#92）同一個做法。
 * 新增與編輯沿用設定頁的類別編輯 sheet：名稱、圖示、顏色。這趟旅程還有支出在用的不能刪。
 */
export function TripCategoriesSection({ trip, open, onToggle, save }: TripCategoriesSectionProps) {
  const { t, tPlural } = useI18n()
  const expenses = useTrips((s) => (s.current?.tripId === trip.id ? s.current.expenses : NO_EXPENSES))
  const global = useSettings((s) => s.settings.categories)
  const own = categoriesFor([], trip)
  const [editing, setEditing] = useState<{ category?: Category } | null>(null)
  const confirm = useConfirmDelete()

  const update = (change: (list: TripCategory[]) => TripCategory[]) => void save((x) => ({ ...x, categories: change(x.categories ?? []) }))
  const store = (category: Category) => {
    setEditing(null)
    const entry: TripCategory = { id: category.id, name: category.name ?? '', icon: category.icon, colorKey: category.colorKey }
    update((list) => (list.some((c) => c.id === entry.id) ? list.map((c) => (c.id === entry.id ? entry : c)) : [...list, entry]))
  }

  return (
    <Accordion
      title={t('tripCategories.title')}
      summary={own.length === 0 ? t('tripMethods.none') : own.map((c) => c.name).join('・')}
      open={open}
      onToggle={onToggle}
      data-testid="section-trip-categories"
    >
      <div className="app-form">
        <p className="app-field-label m-0">{t('tripCategories.hint')}</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {own.map((category) => {
            const used = expenses.filter((e) => !e.deletedAt && e.categoryId === category.id).length
            const name = category.name ?? ''
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
          // 顏色避開全域與這趟旅程已經用掉的
          usedColors={[...global, ...own].map((c) => c.colorKey)}
          onSave={store}
          onClose={() => setEditing(null)}
        />
        {confirm.dialog}
      </div>
    </Accordion>
  )
}
