import { convertToBaseMinor, decimalsOf, sharesOf, toMinor } from '@billing/core'
import { Avatar, Icon } from '@billing/ui'
import { Navigate, useParams } from 'react-router'
import { BootSkeleton } from '../../app/BootSkeleton'
import { displayName } from '../../domain/names'
import { paymentMethodsFor } from '../../domain/paymentMethods'
import { formatWeekday } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores, useTrips } from '../../stores/StoresProvider'
import { ReceiptThumbnail } from '../forms/ReceiptThumbnail'
import { DraftNote, Fact, ViewShell } from '../forms/ViewShell'
import { useOpenTrip } from '../useOpenTrip'
import { categoriesFor, categoryGlyph, categoryLabel } from '../../domain/categories'

/** 支出的唯讀檢視（task#101）：金額、明細、各人分攤、收據 */
export function ExpenseViewScreen() {
  const { tripId = '', expenseId = '' } = useParams()
  const { t, tPlural, money, date } = useI18n()
  const ready = useOpenTrip(tripId)
  const { trips } = useStores()
  const trip = useTrips((s) => s.trips.find((x) => x.id === tripId))
  const expense = useTrips((s) => s.current?.expenses.find((e) => e.id === expenseId))
  const globalCategories = useSettings((s) => s.settings.categories)
  const globalMethods = useSettings((s) => s.settings.paymentMethods)

  if (!trip) return <Navigate to="/" replace />
  if (!ready) return <BootSkeleton />
  if (!expense) return <Navigate to={`/trip/${tripId}/expenses`} replace />

  const category = categoriesFor(globalCategories, trip).find((c) => c.id === expense.categoryId)
  const method = paymentMethodsFor(globalMethods, trip).find((m) => m.id === expense.paymentMethodId)
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? id
  const foreign = expense.currency !== trip.baseCurrency
  const base = money(convertToBaseMinor(expense.amount, expense.exchangeRate, trip.baseCurrency), trip.baseCurrency)
  const shares = sharesOf(expense, trip.baseCurrency, trip.members.map((m) => m.id))
  const sharers = trip.members.filter((m) => shares[m.id] !== undefined)
  const sharedTotal = sharers.reduce((sum, m) => sum + shares[m.id]!, 0)
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
      onDelete={() => void trips.getState().deleteExpense(expense.id)}
    >
      {expense.draft ? <DraftNote /> : null}
      {/* 用預存卡付的：在這裡說明它不算進花費，免得以為漏算（task#115） */}
      {expense.fromBalance ? (
        <p role="note" className="app-field-label m-0" data-testid="from-balance-note">
          {t('stored.notCounted', { name: method ? displayName(method) : expense.paymentMethodId })}
        </p>
      ) : null}
      {/* task#107：先看到「什麼、多少、哪天」，其餘細節收在下面的卡片裡 */}
      <section className="app-view-hero" aria-label={t('view.summary')}>
        <span
          className="app-view-hero__icon"
          style={category ? { background: `var(--bi-${category.colorKey})`, color: `var(--bi-${category.colorKey}-fg)` } : { background: 'var(--bi-bg)' }}
        >
          <Icon glyph={categoryGlyph(category, expense.categoryId)} size="lg" />
        </span>
        <span className="app-view-hero__meta">{categoryLabel(category, expense.categoryId)}</span>
        <p className="app-view-hero__amount app-money">{money(toMinor(expense.amount, decimalsOf(expense.currency)), expense.currency)}</p>
        {foreign && expense.exchangeRate > 0 ? (
          <p className="app-view-hero__meta app-money">
            {t('expense.converted', { amount: base })} ・{t('expense.rateInline', { rate: String(expense.exchangeRate) })}
          </p>
        ) : null}
        <p className="app-view-hero__meta">
          {date(expense.date)} ({formatWeekday(expense.date)})
        </p>
      </section>
      <div className="app-card app-view-card">
        <Fact label={t('expense.paidBy')}>{name(expense.paidBy)}</Fact>
        <Fact label={t('expense.paymentMethod')}>{method ? displayName(method) : expense.paymentMethodId}</Fact>
        <Fact label={t('split.title')}>{split}</Fact>
      </div>
      <section aria-labelledby="view-shares" className="app-card app-view-card">
        <h2 id="view-shares" className="app-card__title">
          {t('view.shares')}
        </h2>
        {sharers.map((m) => (
          <div key={m.id} className="app-share">
            <Avatar name={m.name} colorKey={m.colorKey} size="sm" />
            <span>{m.name}</span>
            <span className="app-money">{money(shares[m.id]!, trip.baseCurrency)}</span>
            {/* 各人占這筆的比例；還沒有金額的草稿就不畫 */}
            {sharedTotal > 0 ? (
              <span className="app-share__bar" aria-hidden="true">
                <span style={{ width: `${(shares[m.id]! / sharedTotal) * 100}%`, background: `var(--bi-${m.colorKey})` }} />
              </span>
            ) : null}
          </div>
        ))}
      </section>
      {expense.attachments.length > 0 ? (
        <section aria-labelledby="view-receipts" className="app-card app-view-card">
          <h2 id="view-receipts" className="app-card__title">
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
