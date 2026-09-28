import { Button, CATEGORY_ICONS, Icon } from '@billing/ui'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import type { Category } from '../../data/types'
import { displayName } from '../../domain/names'
import type { RecordUsage } from '../../domain/usage'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores } from '../../stores/StoresProvider'
import { useConfirmDelete } from '../forms/useConfirmDelete'
import { CategoryEditSheet } from './CategoryEditSheet'

/**
 * 類別管理（規格 4.8）。內建的不能刪；自訂的被支出引用時也不能刪（Plan 6 D6），
 * 該列改說明被幾筆使用。
 */
export function CategoriesSection({ usage }: { usage: RecordUsage | null }) {
  const { t, tPlural } = useI18n()
  const { settings } = useStores()
  const categories = useSettings((s) => s.settings.categories)
  const [editing, setEditing] = useState<{ category?: Category } | null>(null)
  const confirm = useConfirmDelete()

  const save = (category: Category) => {
    setEditing(null)
    void settings.getState().update((s) => {
      const exists = s.categories.some((c) => c.id === category.id)
      return {
        ...s,
        categories: exists ? s.categories.map((c) => (c.id === category.id ? category : c)) : [...s.categories, category],
      }
    })
  }
  const remove = (id: string) =>
    void settings.getState().update((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }))

  return (
    <section className="app-form" aria-labelledby="settings-categories">
      <h2 id="settings-categories" className="app-card__title">
        {t('settings.categories')}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {categories.map((category) => {
          const used = usage?.categories[category.id] ?? 0
          const name = displayName(category)
          return (
            <li key={category.id} className="flex items-center gap-2">
              <button type="button" className="app-row flex-1" onClick={() => setEditing({ category })}>
                <span className="flex items-center gap-3">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ background: `var(--bi-${category.colorKey})`, color: `var(--bi-${category.colorKey}-fg)` }}
                  >
                    <Icon glyph={CATEGORY_ICONS[category.icon]} />
                  </span>
                  {name}
                </span>
                <span className="app-row__value">
                  {category.builtin ? t('settings.builtin') : used > 0 ? tPlural('settings.usedBy', { count: used }) : null}
                </span>
              </button>
              {/* 固定寬的尾端欄，與付款方式同樣讓每一列的框對齊（task#93）。使用次數讀到之前不給刪 */}
              <span className="app-slot">
                {!category.builtin && usage && used === 0 ? (
                  <Button variant="ghost" aria-label={t('settings.removeItem', { name })} onClick={() => confirm.ask(name, 'permanent', () => remove(category.id))}>
                    <Icon glyph={IconTrash} />
                  </Button>
                ) : null}
              </span>
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
        usedColors={categories.map((c) => c.colorKey)}
        onSave={save}
        onClose={() => setEditing(null)}
      />
      {confirm.dialog}
    </section>
  )
}
