import { ACCENT_ORDER, Button, CATEGORY_ICONS, ColorSwatches, IconGrid, pickAccent, Sheet, TextField, type AccentSlot, type CategoryIconName } from '@billing/ui'
import { useState } from 'react'
import type { Category } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'

export interface CategoryEditSheetProps {
  open: boolean
  /** 沒給就是新增 */
  category?: Category
  /** 其他類別已經用掉的顏色：新類別預選用得最少的那一格 */
  usedColors: readonly string[]
  onSave: (category: Category) => void
  onClose: () => void
}

/**
 * 新增或編輯類別：名稱、圖示、顏色（規格 4.8）。
 * 內建類別沒有名稱欄位：它的名稱來自語言檔，改了切換語系就對不起來。
 */
export function CategoryEditSheet({ open, category, usedColors, onSave, onClose }: CategoryEditSheetProps) {
  const { t } = useI18n()
  const initial = () => ({
    name: category?.name ?? '',
    icon: category?.icon ?? ('IconDots' as CategoryIconName),
    colorKey: category?.colorKey ?? pickAccent(usedColors),
  })
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(initial())
      setError(false)
    }
  }

  const isCustom = !category?.builtin
  const save = () => {
    const name = draft.name.trim()
    if (isCustom && !name) {
      setError(true)
      return
    }
    onSave({
      ...(category ?? { id: crypto.randomUUID(), builtin: false }),
      ...(isCustom ? { name } : {}),
      icon: draft.icon,
      colorKey: draft.colorKey,
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title={category ? t('settings.editCategory') : t('settings.addCategory')}>
      <div className="app-form">
        {isCustom ? (
          <TextField
            label={t('settings.categoryName')}
            value={draft.name}
            onChange={(name) => setDraft((d) => ({ ...d, name }))}
            error={error ? t('settings.nameRequired') : undefined}
          />
        ) : null}
        <div>
          <p className="app-field-label">{t('settings.categoryIcon')}</p>
          <IconGrid
            icons={CATEGORY_ICONS}
            value={draft.icon}
            onChange={(icon) => setDraft((d) => ({ ...d, icon }))}
            ariaLabel={t('settings.categoryIcon')}
            // 已知的妥協：圖示名稱用英文識別字，沒有翻成兩種語言（task 另記）
            labelFor={(name) => name.replace(/^Icon/, '')}
          />
        </div>
        <div>
          <p className="app-field-label">{t('settings.categoryColor')}</p>
          <ColorSwatches
            // 依指派順序排：相鄰的兩格正是差最多的兩格
            keys={ACCENT_ORDER}
            value={draft.colorKey}
            onChange={(key) => setDraft((d) => ({ ...d, colorKey: key as AccentSlot }))}
            ariaLabel={t('settings.categoryColor')}
            labelFor={(key) => t('settings.colorN', { n: ACCENT_ORDER.indexOf(key as AccentSlot) + 1 })}
          />
        </div>
        <Button onClick={save}>{t('settings.save')}</Button>
      </div>
    </Sheet>
  )
}
