import { convertToBaseMinor, type Expense } from '@billing/core'
import { Fab, ProgressBar } from '@billing/ui'
import { IconPlus } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router'
import { formatWeekday } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores, useTrips } from '../../stores/StoresProvider'
import { ExpenseRow } from './ExpenseRow'

/** 依日期分組，保留 store 裡新到舊的順序（規格 4.3） */
function byDay(expenses: Expense[]): [string, Expense[]][] {
  const groups = new Map<string, Expense[]>()
  for (const e of expenses) groups.set(e.date, [...(groups.get(e.date) ?? []), e])
  return [...groups]
}

/** 支出列表（規格 4.3，tab 1）。轉帳不在這裡：轉帳不是消費（規格 2.5） */
export function ExpensesTab() {
  const { tripId = '' } = useParams()
  const { t, money, date } = useI18n()
  const navigate = useNavigate()
  const { trips } = useStores()
  const trip = useTrips((s) => s.trips.find((x) => x.id === tripId))
  const expenses = useTrips((s) => (s.current?.tripId === tripId ? s.current.expenses : undefined))
  const summary = useTrips((s) => s.summaries[tripId])
  const categories = useSettings((s) => s.settings.categories)
  if (!trip || !expenses) return null

  const budget = summary?.budget
  const spent = money(summary?.spentMinor ?? 0, trip.baseCurrency)

  return (
    <>
      <div className="app-sticky">
        <span className="app-money">
          {budget ? t('expenses.summary', { spent, budget: money(budget.budgetMinor, trip.baseCurrency) }) : t('expenses.spent', { amount: spent })}
        </span>
        {budget ? (
          <ProgressBar
            ratio={budget.ratio}
            level={budget.level}
            ariaLabel={t('expenses.budget', { percent: Math.min(999, Math.round(budget.ratio * 100)) })}
          />
        ) : null}
      </div>
      {expenses.length === 0 ? <p className="app-empty">{t('expenses.empty')}</p> : null}
      <div className="pb-24">
        {byDay(expenses).map(([day, list]) => (
          <section key={day} aria-label={`${date(day)} ${formatWeekday(day)}`}>
            <h2 className="app-day m-0 font-normal">
              <span>
                {date(day)} ({formatWeekday(day)})
              </span>
              <span className="app-money">
                {t('expenses.dayTotal', {
                  amount: money(
                    list.reduce((sum, e) => sum + convertToBaseMinor(e.amount, e.exchangeRate, trip.baseCurrency), 0),
                    trip.baseCurrency,
                  ),
                })}
              </span>
            </h2>
            {list.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                trip={trip}
                category={categories.find((c) => c.id === expense.categoryId)}
                onOpen={() => navigate(`/trip/${tripId}/expense/${expense.id}`)}
                onDelete={() => void trips.getState().deleteExpense(expense.id)}
              />
            ))}
          </section>
        ))}
      </div>
      <Fab glyph={IconPlus} ariaLabel={t('expenses.add')} onPress={() => navigate(`/trip/${tripId}/expense/new`)} />
    </>
  )
}
