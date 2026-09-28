import { convertToBaseMinor, decimalsOf, toMinor } from '@billing/core'
import { Avatar, Icon } from '@billing/ui'
import { IconArrowRight } from '@tabler/icons-react'
import { Navigate, useParams } from 'react-router'
import { BootSkeleton } from '../../app/BootSkeleton'
import { formatWeekday } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useTrips } from '../../stores/StoresProvider'
import { DraftNote, Fact, ViewShell } from '../forms/ViewShell'
import { useOpenTrip } from '../useOpenTrip'

/** 轉帳的唯讀檢視（task#101） */
export function TransferViewScreen() {
  const { tripId = '', transferId = '' } = useParams()
  const { t, money, date } = useI18n()
  const ready = useOpenTrip(tripId)
  const trip = useTrips((s) => s.trips.find((x) => x.id === tripId))
  const transfer = useTrips((s) => s.current?.transfers.find((x) => x.id === transferId))

  if (!trip) return <Navigate to="/" replace />
  if (!ready) return <BootSkeleton />
  if (!transfer) return <Navigate to={`/trip/${tripId}/settle`} replace />

  const member = (id: string) => trip.members.find((m) => m.id === id)
  const name = (id: string) => member(id)?.name ?? id
  const foreign = transfer.currency !== trip.baseCurrency
  const person = (id: string) => (
    <span className="app-view-hero__person">
      <Avatar name={name(id)} colorKey={member(id)?.colorKey} size="lg" />
      <span>{name(id)}</span>
    </span>
  )
  return (
    <ViewShell
      title={`${name(transfer.from)} → ${name(transfer.to)}`}
      editTo={`/trip/${tripId}/transfer/${transferId}/edit`}
      fallback={`/trip/${tripId}/settle`}
    >
      {transfer.draft ? <DraftNote /> : null}
      {/* task#107：誰給誰一眼看出來，金額放大 */}
      <section className="app-view-hero" aria-label={t('view.summary')}>
        <span className="app-view-hero__people">
          {person(transfer.from)}
          <span className="app-view-hero__arrow">
            <Icon glyph={IconArrowRight} size="lg" ariaLabel={t('transfer.to')} />
          </span>
          {person(transfer.to)}
        </span>
        <p className="app-view-hero__amount app-money">{money(toMinor(transfer.amount, decimalsOf(transfer.currency)), transfer.currency)}</p>
        {foreign && transfer.exchangeRate > 0 ? (
          <p className="app-view-hero__meta app-money">
            {t('expense.converted', { amount: money(convertToBaseMinor(transfer.amount, transfer.exchangeRate, trip.baseCurrency), trip.baseCurrency) })}
          </p>
        ) : null}
        <p className="app-view-hero__meta">
          {date(transfer.date)} ({formatWeekday(transfer.date)})
        </p>
      </section>
      <div className="app-card app-view-card">
        <Fact label={t('transfer.kind')}>{t(`transfer.${transfer.kind}`)}</Fact>
        {transfer.note ? <Fact label={t('transfer.note')}>{transfer.note}</Fact> : null}
      </div>
    </ViewShell>
  )
}
