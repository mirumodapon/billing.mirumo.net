import type { Expense, Trip } from '@billing/core'
import { Accordion, Avatar, BarChart, ChipGroup, Donut, ProgressBar } from '@billing/ui'
import { useParams } from 'react-router'
import { statsView, type StatsView } from '../../domain/statsView'
import { formatCompact } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useTrips } from '../../stores/StoresProvider'
import { useCollapsedStats, useStatsViewpoint } from './useStatsViewpoint'

/** 視角選單裡「全團」的值。成員 id 是 UUID，不會撞到 */
const GROUP = 'group'

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
  const [viewpoint, setViewpoint] = useStatsViewpoint(trip)
  const [isOpen, toggle] = useCollapsedStats()
  const memberId = viewpoint.scope === 'self' ? viewpoint.memberId : trip.selfMemberId
  const view = statsView(trip, expenses, viewpoint.scope, categories, memberId)
  const format = (minor: number) => money(minor, trip.baseCurrency)
  const budget = view.budget
  const viewed = trip.members.find((m) => m.id === memberId)

  return (
    <div className="flex flex-col gap-2 p-4 pb-24">
      {/* 全團，或任何一位成員的視角：看的是那個人該負擔多少，與誰先付無關 */}
      <ChipGroup
        ariaLabel={t('stats.scope')}
        value={viewpoint.scope === 'group' ? GROUP : viewpoint.memberId}
        options={[
          { value: GROUP, label: t('stats.group') },
          ...trip.members.map((m) => ({
            value: m.id,
            label: m.id === trip.selfMemberId ? t('stats.memberSelf', { name: m.name }) : m.name,
            colorKey: m.colorKey,
          })),
        ]}
        onChange={(value) => setViewpoint(value === GROUP ? { scope: 'group' } : { scope: 'self', memberId: value })}
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
          formatTick={(minor) => formatCompact(minor, trip.baseCurrency)}
          budget={view.dailyBudgetMinor}
          budgetLabel={t('stats.dailyBudget')}
          overBudgetLabel={t('stats.overBudget')}
          emptyLabel={t('stats.empty')}
        />
      </Accordion>
      {view.members ? (
        <Accordion title={t('stats.members')} open={isOpen('members')} onToggle={() => toggle('members')} data-testid="stats-members">
          <MemberBars members={view.members} format={format} />
        </Accordion>
      ) : null}
      {view.items ? (
        <Accordion title={memberId === trip.selfMemberId ? t('stats.myItems') : t('stats.memberItems', { name: viewed?.name ?? '' })} open={isOpen('items')} onToggle={() => toggle('items')} data-testid="stats-items">
          <MyItems items={view.items} format={format} />
        </Accordion>
      ) : null}
    </div>
  )
}

/** 成員比較（僅全團）：條長以最多的人為滿格，比較誰負擔得多（Plan 9 T5） */
function MemberBars({ members, format }: { members: NonNullable<StatsView['members']>; format: (minor: number) => string }) {
  const most = Math.max(0, ...members.map((m) => m.owedMinor))
  return (
    <div>
      {members.map((m) => (
        <div key={m.id} className="app-share" data-testid="stats-member">
          <Avatar name={m.name} colorKey={m.colorKey} size="sm" />
          <span>{m.name}</span>
          <span className="app-money">{format(m.owedMinor)}</span>
          {most > 0 ? (
            <span className="app-share__bar" aria-hidden="true">
              <span style={{ width: `${(Math.max(0, m.owedMinor) / most) * 100}%`, background: `var(--bi-${m.colorKey})` }} />
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** 我的消費明細（僅「我」）：我分攤到的每一項，攤回的服務費另一列（規格 4.5） */
function MyItems({ items, format }: { items: NonNullable<StatsView['items']>; format: (minor: number) => string }) {
  const { t, date } = useI18n()
  if (items.rows.length === 0) return <p className="app-field-label m-0">{t('stats.empty')}</p>
  return (
    <ul className="m-0 list-none p-0">
      {items.rows.map((row) => (
        <li key={`${row.expenseId}-${row.itemId ?? ''}`} className="app-fact" data-testid="stats-item">
          <span>
            {row.name.trim() || t('expense.untitled')}
            <span className="app-field-label m-0 block">{date(row.date)}</span>
          </span>
          <span className="app-money">{format(row.shareMinor)}</span>
        </li>
      ))}
      {items.overflowMinor !== 0 ? (
        <li className="app-fact" data-testid="stats-overflow">
          <span>{t('stats.overflow')}</span>
          <span className="app-money">{format(items.overflowMinor)}</span>
        </li>
      ) : null}
    </ul>
  )
}
