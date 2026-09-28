import { convertToBaseMinor, countsInTotals, type Expense } from '@billing/core'
import { Button, Fab, Icon, ProgressBar } from '@billing/ui'
import { IconArrowsExchange, IconFilter, IconFilterFilled, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { EMPTY_FILTER, filterExpenses, isFilterActive, type ExpenseFilter } from '../../domain/expenseFilter'
import { formatWeekday } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores, useTrips, useUi } from '../../stores/StoresProvider'
import { ExpenseFilterSheet } from './ExpenseFilterSheet'
import { useConfirmDelete } from '../forms/useConfirmDelete'
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
  const { trips, settings, ui } = useStores()
  const trip = useTrips((s) => s.trips.find((x) => x.id === tripId))
  const expenses = useTrips((s) => (s.current?.tripId === tripId ? s.current.expenses : undefined))
  const summary = useTrips((s) => s.summaries[tripId])
  const categories = useSettings((s) => s.settings.categories)
  // 沒設定過就是顯示（task#99）
  const showBase = useSettings((s) => s.settings.showBaseAmounts ?? true)
  const filter = useUi((s) => s.expenseFilters[tripId]) ?? EMPTY_FILTER
  const [filtering, setFiltering] = useState(false)
  const confirm = useConfirmDelete()
  if (!trip || !expenses) return null

  const setFilter = (next: ExpenseFilter) => ui.getState().setExpenseFilter(tripId, next)
  const active = isFilterActive(filter)
  const shown = active ? filterExpenses(expenses, filter) : expenses
  const baseTotal = (list: Expense[]) => list.reduce((sum, e) => sum + convertToBaseMinor(e.amount, e.exchangeRate, trip.baseCurrency), 0)

  const budget = summary?.budget
  const spent = money(summary?.spentMinor ?? 0, trip.baseCurrency)

  return (
    <>
      <div className="app-sticky">
        <div className="app-sticky__row">
          <span className="app-money">
            {budget ? t('expenses.summary', { spent, budget: money(budget.budgetMinor, trip.baseCurrency) }) : t('expenses.spent', { amount: spent })}
          </span>
          <span className="flex">
            <button
              type="button"
              className="app-icon-toggle"
              aria-label={t('expenses.showBase')}
              aria-pressed={showBase}
              onClick={() => void settings.getState().update((s) => ({ ...s, showBaseAmounts: !showBase }))}
            >
              <Icon glyph={IconArrowsExchange} />
            </button>
            <button type="button" className="app-icon-toggle" aria-label={t('expenses.filter')} aria-haspopup="dialog" data-active={active || undefined} onClick={() => setFiltering(true)}>
              <Icon glyph={active ? IconFilterFilled : IconFilter} />
            </button>
          </span>
        </div>
        {budget ? (
          <ProgressBar
            ratio={budget.ratio}
            level={budget.level}
            ariaLabel={t('expenses.budget', { percent: Math.min(999, Math.round(budget.ratio * 100)) })}
          />
        ) : null}
        {active ? (
          <div role="status" className="app-sticky__row app-field-label m-0">
            <span className="app-money">
              {t('expenses.filtered', { count: shown.length, amount: money(baseTotal(shown.filter(countsInTotals)), trip.baseCurrency) })}
            </span>
            <Button variant="ghost" onClick={() => setFilter(EMPTY_FILTER)}>
              {t('expenses.clearFilter')}
            </Button>
          </div>
        ) : null}
      </div>
      {expenses.length === 0 ? <p className="app-empty">{t('expenses.empty')}</p> : null}
      {expenses.length > 0 && shown.length === 0 ? <p className="app-empty">{t('expenses.noMatch')}</p> : null}
      <ExpenseFilterSheet open={filtering} onClose={() => setFiltering(false)} trip={trip} expenses={expenses} filter={filter} onChange={setFilter} />
      <div className="pb-24">
        {byDay(shown).map(([day, list]) => (
          <section key={day} aria-label={`${date(day)} ${formatWeekday(day)}`}>
            <h2 className="app-day m-0 font-normal">
              <span>
                {date(day)} ({formatWeekday(day)})
              </span>
              <span className="app-money">
                {t('expenses.dayTotal', {
                  amount: money(baseTotal(list.filter(countsInTotals)), trip.baseCurrency),
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
                onDelete={() => confirm.ask(expense.description.trim() || t('expense.untitled'), 'undoable', () => void trips.getState().deleteExpense(expense.id))}
                showBase={showBase}
              />
            ))}
          </section>
        ))}
      </div>
      {confirm.dialog}
      <Fab glyph={IconPlus} ariaLabel={t('expenses.add')} onPress={() => navigate(`/trip/${tripId}/expense/new`)} />
    </>
  )
}
