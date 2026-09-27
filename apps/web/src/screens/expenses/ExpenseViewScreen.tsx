import { convertToBaseMinor, decimalsOf, sharesOf, toMinor } from '@billing/core'
import { Navigate, useParams } from 'react-router'
import { BootSkeleton } from '../../app/BootSkeleton'
import { displayName } from '../../domain/names'
import { paymentMethodsFor } from '../../domain/paymentMethods'
import { formatWeekday } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useTrips } from '../../stores/StoresProvider'
import { ReceiptThumbnail } from '../forms/ReceiptThumbnail'
import { Fact, ViewShell } from '../forms/ViewShell'
import { useOpenTrip } from '../useOpenTrip'

/** 支出的唯讀檢視（task#101）：金額、明細、各人分攤、收據 */
export function ExpenseViewScreen() {
  const { tripId = '', expenseId = '' } = useParams()
  const { t, tPlural, money, date } = useI18n()
  const ready = useOpenTrip(tripId)
  const trip = useTrips((s) => s.trips.find((x) => x.id === tripId))
  const expense = useTrips((s) => s.current?.expenses.find((e) => e.id === expenseId))
  const categories = useSettings((s) => s.settings.categories)
  const globalMethods = useSettings((s) => s.settings.paymentMethods)

  if (!trip) return <Navigate to="/" replace />
  if (!ready) return <BootSkeleton />
  if (!expense) return <Navigate to={`/trip/${tripId}/expenses`} replace />

  const category = categories.find((c) => c.id === expense.categoryId)
  const method = paymentMethodsFor(globalMethods, trip).find((m) => m.id === expense.paymentMethodId)
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? id
  const foreign = expense.currency !== trip.baseCurrency
  const base = money(convertToBaseMinor(expense.amount, expense.exchangeRate, trip.baseCurrency), trip.baseCurrency)
  const shares = sharesOf(expense, trip.baseCurrency, trip.members.map((m) => m.id))
  const split =
    expense.split.mode === 'even'
      ? t('split.summaryEvenNoAmount', { count: expense.split.participants.length })
      : expense.split.mode === 'items'
        ? tPlural('split.summaryItems', { count: expense.split.items.length })
        : t('split.summaryExact')

  return (
    <ViewShell
      title={expense.description.trim() || t('expense.untitled')}
      editTo={`/trip/${tripId}/expense/${expenseId}/edit`}
      fallback={`/trip/${tripId}/expenses`}
    >
      <p className="app-money m-0 text-end text-2xl">{money(toMinor(expense.amount, decimalsOf(expense.currency)), expense.currency)}</p>
      {foreign ? (
        <p className="app-field-label app-money m-0 text-end">
          {t('expense.converted', { amount: base })} ・{t('expense.rateInline', { rate: String(expense.exchangeRate) })}
        </p>
      ) : null}
      <div>
        <Fact label={t('expense.category')}>{category ? displayName(category) : expense.categoryId}</Fact>
        <Fact label={t('expense.paymentMethod')}>{method ? displayName(method) : expense.paymentMethodId}</Fact>
        <Fact label={t('expense.paidBy')}>{name(expense.paidBy)}</Fact>
        <Fact label={t('expense.date')}>
          {date(expense.date)} ({formatWeekday(expense.date)})
        </Fact>
        <Fact label={t('split.title')}>{split}</Fact>
      </div>
      <section aria-labelledby="view-shares">
        <h2 id="view-shares" className="app-field-label">
          {t('view.shares')}
        </h2>
        {trip.members
          .filter((m) => shares[m.id] !== undefined)
          .map((m) => (
            <Fact key={m.id} label={m.name}>
              <span className="app-money">{money(shares[m.id]!, trip.baseCurrency)}</span>
            </Fact>
          ))}
      </section>
      {expense.attachments.length > 0 ? (
        <section aria-labelledby="view-receipts">
          <h2 id="view-receipts" className="app-field-label">
            {t('view.receipts')}
          </h2>
          <div className="flex flex-wrap gap-3">
            {expense.attachments.map((meta, index) => (
              <ReceiptThumbnail key={meta.id} meta={meta} label={t('receipt.photo', { n: index + 1 })} />
            ))}
          </div>
        </section>
      ) : null}
    </ViewShell>
  )
}
