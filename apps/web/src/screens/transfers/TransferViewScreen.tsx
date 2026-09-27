import { convertToBaseMinor, decimalsOf, toMinor } from '@billing/core'
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

  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? id
  const foreign = transfer.currency !== trip.baseCurrency
  return (
    <ViewShell
      title={`${name(transfer.from)} → ${name(transfer.to)}`}
      editTo={`/trip/${tripId}/transfer/${transferId}/edit`}
      fallback={`/trip/${tripId}/settle`}
    >
      {transfer.draft ? <DraftNote /> : null}
      <p className="app-money m-0 text-end text-2xl">{money(toMinor(transfer.amount, decimalsOf(transfer.currency)), transfer.currency)}</p>
      {foreign && transfer.exchangeRate > 0 ? (
        <p className="app-field-label app-money m-0 text-end">
          {t('expense.converted', { amount: money(convertToBaseMinor(transfer.amount, transfer.exchangeRate, trip.baseCurrency), trip.baseCurrency) })}
        </p>
      ) : null}
      <div>
        <Fact label={t('transfer.from')}>{name(transfer.from)}</Fact>
        <Fact label={t('transfer.to')}>{name(transfer.to)}</Fact>
        <Fact label={t('transfer.kind')}>{t(`transfer.${transfer.kind}`)}</Fact>
        <Fact label={t('expense.date')}>
          {date(transfer.date)} ({formatWeekday(transfer.date)})
        </Fact>
        {transfer.note ? <Fact label={t('transfer.note')}>{transfer.note}</Fact> : null}
      </div>
    </ViewShell>
  )
}
