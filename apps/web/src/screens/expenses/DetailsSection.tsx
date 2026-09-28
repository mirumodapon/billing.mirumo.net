import type { Expense } from '@billing/core'
import { Accordion, ChipGroup } from '@billing/ui'
import { withAutoRate } from '../../domain/expenseDraft'
import { displayName } from '../../domain/names'
import { paymentMethodsFor } from '../../domain/paymentMethods'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useTrips } from '../../stores/StoresProvider'
import { DateField } from '../forms/DateField'
import type { FormSectionProps } from './ExpenseFormScreen'
import { categoriesFor } from '../../domain/categories'
import { storedBalances, storedMethodIds } from '../../domain/storedValue'

// selector 每次回新的 [] 會讓 useSyncExternalStore 無限重繪
const NO_EXPENSES: Expense[] = []

/**
 * 類別、付款方式、付款人、日期（規格 4.4 的「明細」區塊）。預設值夠準，
 * 典型情境下不必展開；收折時的摘要讓人一眼確認帶入的值對不對。
 */
export function DetailsSection({ trip, draft, change, open, onToggle }: FormSectionProps & { open: boolean; onToggle: () => void }) {
  const { t, date, money } = useI18n()
  // 全域類別加上這趟旅程專用的（task#114）
  const categories = categoriesFor(useSettings((s) => s.settings.categories), trip)
  const globalMethods = useSettings((s) => s.settings.paymentMethods)
  const expenses = useTrips((s) => (s.current?.tripId === trip.id ? s.current.expenses : NO_EXPENSES))
  const stored = storedMethodIds(trip)
  // 儲值不能用預存卡付（task#115）：列表裡拿掉它們
  const methods = paymentMethodsFor(globalMethods, trip).filter((m) => !draft.topUpFor || !stored.has(m.id))
  const card = draft.topUpFor ? undefined : trip.paymentMethods?.find((m) => m.id === draft.paymentMethodId && m.storedValue)
  const balance = card ? storedBalances(trip, expenses)[card.id] : undefined
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
            // 規格 4.4：改付款方式會重算帶入的匯率（手動改過的除外）。
            // 選預存卡時幣別換成卡片的幣別：餘額只認那個幣別（task#115）
            onChange={(paymentMethodId) =>
              change((d) => {
                const picked = !d.topUpFor ? trip.paymentMethods?.find((m) => m.id === paymentMethodId)?.storedValue : undefined
                return withAutoRate({ ...d, paymentMethodId, ...(picked ? { currency: picked.currency } : {}) }, trip)
              })
            }
          />
          {card && balance ? (
            <p className="app-field-label m-0 mt-2" data-testid="stored-note">
              {t('stored.fromBalance', { name: card.name, amount: money(balance.minor, balance.currency) })}
            </p>
          ) : null}
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
