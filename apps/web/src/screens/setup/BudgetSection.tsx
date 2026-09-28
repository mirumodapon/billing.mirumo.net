import { decimalsOf, minDisplayDecimalsOf, toMinor, type Trip, type TripBudget } from '@billing/core'
import { Accordion, SegmentedControl } from '@billing/ui'
import { useI18n } from '../../i18n/useI18n'
import { AmountField } from './AmountField'

export interface BudgetSectionProps {
  trip: Trip
  open: boolean
  onToggle: () => void
  save: (change: (t: Trip) => Trip) => Promise<Trip | undefined>
}

/** 未設定就移除那個欄位，而不是存 undefined 或 0：記憶體與匯出的形狀一致 */
function withAmount(budget: TripBudget, key: 'total' | 'daily', value: number | undefined): TripBudget {
  const next = { ...budget }
  if (value === undefined) delete next[key]
  else next[key] = value
  return next
}

/** 總預算、每日預算、口徑（規格 3.6、4.7） */
export function BudgetSection({ trip, open, onToggle, save }: BudgetSectionProps) {
  const { t, money } = useI18n()
  const decimals = decimalsOf(trip.baseCurrency)
  const format = (v: number) => money(toMinor(v, decimals), trip.baseCurrency)
  const { total, daily, scope } = trip.budget
  const summary =
    total === undefined && daily === undefined
      ? t('budget.summaryNone')
      : [total, daily].filter((v): v is number => v !== undefined).map(format).join(' · ')

  const setAmount = (key: 'total' | 'daily') => (value: number | undefined) =>
    void save((x) => ({ ...x, budget: withAmount(x.budget, key, value) }))

  return (
    <Accordion title={t('budget.title')} summary={summary} open={open} onToggle={onToggle} data-testid="section-budget">
      <div className="app-form">
        <AmountField label={t('budget.total')} value={total} decimals={decimals} minDecimals={minDisplayDecimalsOf(trip.baseCurrency)} format={format} onChange={setAmount('total')} />
        <AmountField label={t('budget.daily')} value={daily} decimals={decimals} minDecimals={minDisplayDecimalsOf(trip.baseCurrency)} format={format} onChange={setAmount('daily')} />
        <div>
          <p className="app-field-label">{t('budget.scope')}</p>
          <SegmentedControl<'self' | 'group'>
            ariaLabel={t('budget.scope')}
            value={scope}
            options={[
              { value: 'self', label: t('budget.scopeSelf') },
              { value: 'group', label: t('budget.scopeGroup') },
            ]}
            onChange={(s) => void save((x) => ({ ...x, budget: { ...x.budget, scope: s } }))}
          />
        </div>
      </div>
    </Accordion>
  )
}
