import type { Expense, Trip } from '@billing/core'
import { Accordion, BarChart, Donut, ProgressBar, SegmentedControl } from '@billing/ui'
import { useParams } from 'react-router'
import { statsView } from '../../domain/statsView'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useTrips } from '../../stores/StoresProvider'
import { useCollapsedStats, useStatsScope } from './useStatsScope'

/** 統計（規格 4.5，tab 2）。數字都來自 statsView；這裡只排版 */
export function StatsTab() {
  const { tripId = '' } = useParams()
  const trip = useTrips((s) => s.trips.find((x) => x.id === tripId))
  const expenses = useTrips((s) => (s.current?.tripId === tripId ? s.current.expenses : undefined))
  if (!trip || !expenses) return null
  return <Stats trip={trip} expenses={expenses} />
}

function Stats({ trip, expenses }: { trip: Trip; expenses: Expense[] }) {
  const { t, money, date } = useI18n()
  const categories = useSettings((s) => s.settings.categories)
  const [scope, setScope] = useStatsScope()
  const [isOpen, toggle] = useCollapsedStats()
  const view = statsView(trip, expenses, scope, categories)
  const format = (minor: number) => money(minor, trip.baseCurrency)
  const budget = view.budget

  return (
    <div className="flex flex-col gap-2 p-4 pb-24">
      <SegmentedControl
        ariaLabel={t('stats.scope')}
        value={scope}
        options={[
          { value: 'self', label: t('stats.self') },
          { value: 'group', label: t('stats.group') },
        ]}
        onChange={setScope}
      />
      <Accordion title={t('stats.overview')} summary={format(view.totalMinor)} open={isOpen('overview')} onToggle={() => toggle('overview')} data-testid="stats-overview">
        <div className="flex flex-col gap-2">
          <p className="app-money m-0" data-testid="stats-total">
            {t('stats.total', { amount: format(view.totalMinor) })}
          </p>
          {/* 規格 3.6：沒設總預算時連進度條都不畫。預算用它自己的口徑（Plan 9 T2） */}
          {budget ? (
            <>
              <ProgressBar
                ratio={budget.ratio}
                level={budget.level}
                ariaLabel={t('expenses.budget', { percent: Math.min(999, Math.round(budget.ratio * 100)) })}
              />
              <p className="app-field-label app-money m-0" data-testid="stats-budget">
                {t('stats.budget', {
                  scope: trip.budget.scope === 'self' ? t('stats.self') : t('stats.group'),
                  budget: format(budget.budgetMinor),
                  remaining: format(budget.remainingMinor),
                })}
              </p>
            </>
          ) : null}
        </div>
      </Accordion>
      <Accordion title={t('stats.categories')} open={isOpen('categories')} onToggle={() => toggle('categories')} data-testid="stats-categories">
        <Donut segments={view.categories} ariaLabel={t('stats.categories')} formatValue={format} emptyLabel={t('stats.empty')} totalLabel={t('stats.totalLabel')} />
      </Accordion>
      <Accordion title={t('stats.daily')} open={isOpen('daily')} onToggle={() => toggle('daily')} data-testid="stats-daily">
        <BarChart
          bars={view.days.map((d) => ({ key: d.key, label: date(d.key), value: d.value }))}
          ariaLabel={t('stats.daily')}
          formatValue={format}
          budget={view.dailyBudgetMinor}
          budgetLabel={t('stats.dailyBudget')}
          overBudgetLabel={t('stats.overBudget')}
          emptyLabel={t('stats.empty')}
        />
      </Accordion>
    </div>
  )
}
