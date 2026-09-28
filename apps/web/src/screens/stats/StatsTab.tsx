import type { Expense, Trip } from '@billing/core'
import { SegmentedControl } from '@billing/ui'
import { useParams } from 'react-router'
import { statsView } from '../../domain/statsView'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useTrips } from '../../stores/StoresProvider'
import { useStatsScope } from './useStatsScope'

/** 統計（規格 4.5，tab 2）。數字都來自 statsView；這裡只排版 */
export function StatsTab() {
  const { tripId = '' } = useParams()
  const trip = useTrips((s) => s.trips.find((x) => x.id === tripId))
  const expenses = useTrips((s) => (s.current?.tripId === tripId ? s.current.expenses : undefined))
  if (!trip || !expenses) return null
  return <Stats trip={trip} expenses={expenses} />
}

function Stats({ trip, expenses }: { trip: Trip; expenses: Expense[] }) {
  const { t, money } = useI18n()
  const categories = useSettings((s) => s.settings.categories)
  const [scope, setScope] = useStatsScope()
  const view = statsView(trip, expenses, scope, categories)

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <SegmentedControl
        ariaLabel={t('stats.scope')}
        value={scope}
        options={[
          { value: 'self', label: t('stats.self') },
          { value: 'group', label: t('stats.group') },
        ]}
        onChange={setScope}
      />
      <p className="app-money m-0" data-testid="stats-total">
        {t('stats.total', { amount: money(view.totalMinor, trip.baseCurrency) })}
      </p>
    </div>
  )
}
