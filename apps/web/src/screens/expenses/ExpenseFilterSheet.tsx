import type { Expense, Trip } from '@billing/core'
import { Button, Chip, Sheet, type AccentSlot } from '@billing/ui'
import { EMPTY_FILTER, toggleIn, usedIds, type ExpenseFilter } from '../../domain/expenseFilter'
import { displayName } from '../../domain/names'
import { paymentMethodsFor } from '../../domain/paymentMethods'
import { useI18n } from '../../i18n/useI18n'
import { useSettings } from '../../stores/StoresProvider'
import { categoriesFor, NO_CATEGORY } from '../../domain/categories'

export interface ExpenseFilterSheetProps {
  open: boolean
  onClose: () => void
  trip: Trip
  expenses: readonly Expense[]
  filter: ExpenseFilter
  onChange: (filter: ExpenseFilter) => void
}

interface Option {
  value: string
  label: string
  colorKey?: AccentSlot
}

/**
 * 支出篩選（task#106）：類別、誰付的、付款方式可以複選，另有「只看草稿」。
 * 類別與付款方式只列這趟旅程用過的，免得一整排從沒出現過的選項。
 */
export function ExpenseFilterSheet({ open, onClose, trip, expenses, filter, onChange }: ExpenseFilterSheetProps) {
  const { t } = useI18n()
  // 全域類別加上這趟旅程專用的（task#114）
  const categories = categoriesFor(useSettings((s) => s.settings.categories), trip)
  const globalMethods = useSettings((s) => s.settings.paymentMethods)
  // 儲值沒有類別（task#142），不列進類別篩選
  const usedCategories = usedIds(expenses.filter((e) => !e.topUpFor), (e) => e.categoryId, filter.categoryIds)
  const usedMethods = usedIds(expenses, (e) => e.paymentMethodId, filter.paymentMethodIds)

  // 有沒選類別的支出時，另外列一個「未分類」（task#127）
  const categoryOptions: Option[] = [
    ...(usedCategories.has(NO_CATEGORY) ? [{ value: NO_CATEGORY, label: t('cat.none') }] : []),
    ...categories.filter((c) => usedCategories.has(c.id)).map((c) => ({ value: c.id, label: displayName(c), colorKey: c.colorKey })),
  ]
  const payerOptions: Option[] = trip.members.map((m) => ({ value: m.id, label: m.name, colorKey: m.colorKey }))
  const methodOptions: Option[] = paymentMethodsFor(globalMethods, trip)
    .filter((m) => usedMethods.has(m.id))
    .map((m) => ({ value: m.id, label: displayName(m) }))

  return (
    <Sheet open={open} onClose={onClose} title={t('expenses.filter')}>
      <div className="flex flex-col gap-4">
        <ChipSet label={t('expense.category')} options={categoryOptions} chosen={filter.categoryIds} onToggle={(v) => onChange({ ...filter, categoryIds: toggleIn(filter.categoryIds, v) })} />
        <ChipSet label={t('expense.paidBy')} options={payerOptions} chosen={filter.payers} onToggle={(v) => onChange({ ...filter, payers: toggleIn(filter.payers, v) })} />
        <ChipSet
          label={t('expense.paymentMethod')}
          options={methodOptions}
          chosen={filter.paymentMethodIds}
          onToggle={(v) => onChange({ ...filter, paymentMethodIds: toggleIn(filter.paymentMethodIds, v) })}
        />
        <ChipSet
          label={t('filter.other')}
          options={[{ value: 'drafts', label: t('filter.draftsOnly') }]}
          chosen={filter.draftsOnly ? ['drafts'] : []}
          onToggle={() => onChange({ ...filter, draftsOnly: !filter.draftsOnly })}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onChange(EMPTY_FILTER)}>
            {t('expenses.clearFilter')}
          </Button>
          <Button onClick={onClose}>{t('filter.done')}</Button>
        </div>
      </div>
    </Sheet>
  )
}

function ChipSet({ label, options, chosen, onToggle }: { label: string; options: Option[]; chosen: readonly string[]; onToggle: (value: string) => void }) {
  if (options.length === 0) return null
  return (
    <div role="group" aria-label={label}>
      <p className="app-field-label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} label={o.label} colorKey={o.colorKey} selected={chosen.includes(o.value)} onSelect={() => onToggle(o.value)} />
        ))}
      </div>
    </div>
  )
}
