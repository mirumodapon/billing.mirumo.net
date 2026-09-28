import { Accordion, ChipGroup } from '@billing/ui'
import { withAutoRate } from '../../domain/expenseDraft'
import { displayName } from '../../domain/names'
import { paymentMethodsFor } from '../../domain/paymentMethods'
import { useI18n } from '../../i18n/useI18n'
import { useSettings } from '../../stores/StoresProvider'
import { DateField } from '../forms/DateField'
import type { FormSectionProps } from './ExpenseFormScreen'

/**
 * 類別、付款方式、付款人、日期（規格 4.4 的「明細」區塊）。預設值夠準，
 * 典型情境下不必展開；收折時的摘要讓人一眼確認帶入的值對不對。
 */
export function DetailsSection({ trip, draft, change, open, onToggle }: FormSectionProps & { open: boolean; onToggle: () => void }) {
  const { t, date } = useI18n()
  const categories = useSettings((s) => s.settings.categories)
  const globalMethods = useSettings((s) => s.settings.paymentMethods)
  const methods = paymentMethodsFor(globalMethods, trip)
  const category = categories.find((c) => c.id === draft.categoryId)
  const method = methods.find((m) => m.id === draft.paymentMethodId)
  const payer = trip.members.find((m) => m.id === draft.paidBy)
  const summary = [category && displayName(category), method && displayName(method), payer?.name, date(draft.date)].filter(Boolean).join('・')

  return (
    <Accordion title={t('expense.details')} summary={summary} open={open} onToggle={onToggle} data-testid="section-details">
      <div className="app-form">
        <div>
          <p className="app-field-label">{t('expense.category')}</p>
          <ChipGroup
            ariaLabel={t('expense.category')}
            value={draft.categoryId}
            options={categories.map((c) => ({ value: c.id, label: displayName(c), colorKey: c.colorKey }))}
            onChange={(categoryId) => change((d) => ({ ...d, categoryId }))}
          />
        </div>
        <div>
          <p className="app-field-label">{t('expense.paymentMethod')}</p>
          <ChipGroup
            ariaLabel={t('expense.paymentMethod')}
            value={draft.paymentMethodId}
            options={methods.map((m) => ({ value: m.id, label: displayName(m) }))}
            // 規格 4.4：改付款方式會重算帶入的匯率（手動改過的除外）
            onChange={(paymentMethodId) => change((d) => withAutoRate({ ...d, paymentMethodId }, trip))}
          />
        </div>
        <div>
          <p className="app-field-label">{t('expense.paidBy')}</p>
          <ChipGroup
            ariaLabel={t('expense.paidBy')}
            value={draft.paidBy}
            options={trip.members.map((m) => ({ value: m.id, label: m.name, colorKey: m.colorKey }))}
            onChange={(paidBy) => change((d) => ({ ...d, paidBy }))}
          />
        </div>
        <DateField label={t('expense.date')} value={draft.date} onChange={(iso) => change((d) => ({ ...d, date: iso }))} />
      </div>
    </Accordion>
  )
}
