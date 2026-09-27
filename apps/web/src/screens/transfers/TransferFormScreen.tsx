import type { Transfer, TransferKind, Trip } from '@billing/core'
import { ChipGroup, DatePicker, SegmentedControl, TextField } from '@billing/ui'
import { useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { BootSkeleton } from '../../app/BootSkeleton'
import { todayIso } from '../../domain/dates'
import {
  isTransferDraft,
  newTransferDraft,
  parsePrefill,
  toTransfer,
  transferDraftFrom,
  transferProblems,
  withAutoTransferRate,
  withManualTransferRate,
  type TransferDraft,
} from '../../domain/transferDraft'
import { useI18n } from '../../i18n/useI18n'
import { useStores, useTrips } from '../../stores/StoresProvider'
import { FormShell } from '../forms/FormShell'
import { MoneyInput } from '../forms/MoneyInput'
import { useFormDraft } from '../forms/useFormDraft'
import { useOpenTrip } from '../useOpenTrip'

/** 新增（/transfer/new，可帶預填）或編輯（/transfer/:id）轉帳（規格 2.4、4.6） */
export function TransferFormScreen() {
  const { tripId = '', transferId = 'new' } = useParams()
  const ready = useOpenTrip(tripId)
  const trip = useTrips((s) => s.trips.find((t) => t.id === tripId))
  const existing = useTrips((s) => (transferId === 'new' ? undefined : s.current?.transfers.find((x) => x.id === transferId)))

  if (!trip) return <Navigate to="/" replace />
  if (!ready) return <BootSkeleton />
  if (transferId !== 'new' && !existing) return <Navigate to={`/trip/${tripId}/settle`} replace />
  return <TransferForm key={transferId} trip={trip} existing={existing} />
}

function TransferForm({ trip, existing }: { trip: Trip; existing?: Transfer }) {
  const { t, locale } = useI18n()
  const location = useLocation()
  const { trips } = useStores()
  const [initial] = useState<TransferDraft>(() =>
    existing ? transferDraftFrom(existing) : newTransferDraft({ trip, today: todayIso() }, parsePrefill(new URLSearchParams(location.search), trip)),
  )
  // Plan 8 S3：預填在網址裡，所以草稿的 key 也帶上查詢字串——同一組預填回來還原同一份
  const drafted = useFormDraft(location.pathname + location.search, initial, isTransferDraft)
  if (!drafted.ready) return <BootSkeleton />
  const { draft, setDraft: change } = drafted
  const problems = transferProblems(draft)
  const people = trip.members.map((m) => ({ value: m.id, label: m.name, colorKey: m.colorKey }))

  return (
    <FormShell
      title={existing ? t('transfer.edit') : t('transfer.new')}
      canSave={problems.length === 0}
      onSave={async () => Boolean(await trips.getState().saveTransfer(toTransfer(draft, trip.id)))}
      drafted={drafted}
      fallback={`/trip/${trip.id}/settle`}
    >
      {(version) => (
        <div key={version} className="app-form">
          <MoneyInput
            baseCurrency={trip.baseCurrency}
            currency={draft.currency}
            amount={draft.amount}
            exchangeRate={draft.exchangeRate}
            // 預填的結清表單金額已經有了，不必一進來就跳鍵盤
            autoFocus={!existing && draft.amount === undefined}
            onAmount={(amount) => change((d) => ({ ...d, amount }))}
            onCurrency={(currency) => change((d) => withAutoTransferRate({ ...d, currency }, trip))}
            onManualRate={(rate) => change((d) => withManualTransferRate(d, rate))}
          />
          <div>
            <p className="app-field-label">{t('transfer.from')}</p>
            <ChipGroup ariaLabel={t('transfer.from')} value={draft.from} options={people} onChange={(from) => change((d) => ({ ...d, from }))} />
          </div>
          <div>
            <p className="app-field-label">{t('transfer.to')}</p>
            <ChipGroup ariaLabel={t('transfer.to')} value={draft.to} options={people} onChange={(to) => change((d) => ({ ...d, to }))} />
            {problems.includes('sameMember') ? (
              <p role="alert" className="app-error">
                {t('transfer.sameMember')}
              </p>
            ) : null}
          </div>
          <div>
            <p className="app-field-label">{t('transfer.kind')}</p>
            <SegmentedControl<TransferKind>
              ariaLabel={t('transfer.kind')}
              value={draft.kind}
              options={[
                { value: 'loan', label: t('transfer.loan') },
                { value: 'settlement', label: t('transfer.settlement') },
              ]}
              onChange={(kind) => change((d) => ({ ...d, kind }))}
            />
          </div>
          <div>
            <p className="app-field-label">{t('expense.date')}</p>
            <DatePicker
              value={draft.date}
              onChange={(date) => change((d) => ({ ...d, date }))}
              locale={locale}
              ariaLabel={t('expense.date')}
              labels={{ other: t('date.other'), calendarTitle: t('date.calendarTitle'), prevMonth: t('date.prevMonth'), nextMonth: t('date.nextMonth') }}
              rangeStart={trip.startDate}
              rangeEnd={trip.endDate}
            />
          </div>
          <TextField label={t('transfer.note')} value={draft.note} onChange={(note) => change((d) => ({ ...d, note }))} />
        </div>
      )}
    </FormShell>
  )
}
