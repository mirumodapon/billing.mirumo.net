import { Button, DatePicker, Sheet, SheetPicker, TextField } from '@billing/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CURRENCIES, currencyName } from '../domain/currencies'
import { todayIso } from '../domain/dates'
import { createTrip, validateTripDraft, type TripDraft, type TripDraftError } from '../domain/newTrip'
import { useI18n } from '../i18n/useI18n'
import { useSettings, useStores } from '../stores/StoresProvider'

function blankDraft(currency: string): TripDraft {
  const today = todayIso()
  return { name: '', destination: '', startDate: today, endDate: today, baseCurrency: currency, selfName: '' }
}

/**
 * 新增旅程（Plan 6 D5）：只問進得去所需的欄位，建立後直接到設定 tab 補其餘的。
 */
export function NewTripSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { trips } = useStores()
  const defaultCurrency = useSettings((s) => s.settings.lastUsed.currency ?? 'TWD')
  const [draft, setDraft] = useState(() => blankDraft(defaultCurrency))
  const [errors, setErrors] = useState<TripDraftError[]>([])
  const [pickingCurrency, setPickingCurrency] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)

  // 每次打開都是一張空白表單，上次填到一半取消的內容不該留著
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(blankDraft(defaultCurrency))
      setErrors([])
    }
  }

  const set = <K extends keyof TripDraft>(key: K, value: TripDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const error = (e: TripDraftError) => (errors.includes(e) ? t(`newTrip.${e}`) : undefined)
  const dateLabels = {
    other: t('date.other'),
    calendarTitle: t('date.calendarTitle'),
    prevMonth: t('date.prevMonth'),
    nextMonth: t('date.nextMonth'),
  }

  const create = async () => {
    const found = validateTripDraft(draft)
    setErrors(found)
    if (found.length > 0) return
    const trip = createTrip(draft)
    if (await trips.getState().saveTrip(trip)) {
      onClose()
      navigate(`/trip/${trip.id}/setup`)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('trip.new')}>
      <div className="app-form">
        <TextField label={t('newTrip.name')} value={draft.name} onChange={(v) => set('name', v)} error={error('nameRequired')} />
        <TextField label={t('newTrip.destination')} value={draft.destination} onChange={(v) => set('destination', v)} />
        <div>
          <p className="app-field-label">{t('newTrip.startDate')}</p>
          <DatePicker
            value={draft.startDate}
            onChange={(v) => set('startDate', v)}
            locale={locale}
            ariaLabel={t('newTrip.startDate')}
            labels={dateLabels}
          />
        </div>
        <div>
          <p className="app-field-label">{t('newTrip.endDate')}</p>
          <DatePicker
            value={draft.endDate}
            onChange={(v) => set('endDate', v)}
            locale={locale}
            ariaLabel={t('newTrip.endDate')}
            labels={dateLabels}
          />
          {error('dateOrder') ? <p className="app-error">{error('dateOrder')}</p> : null}
        </div>
        <button type="button" className="app-row" aria-haspopup="dialog" onClick={() => setPickingCurrency(true)}>
          <span>{t('newTrip.baseCurrency')}</span>
          <span className="app-row__value">{draft.baseCurrency}</span>
        </button>
        <TextField label={t('newTrip.selfName')} value={draft.selfName} onChange={(v) => set('selfName', v)} error={error('selfNameRequired')} />
        <Button onClick={() => void create()}>{t('newTrip.create')}</Button>
      </div>
      <SheetPicker
        open={pickingCurrency}
        title={t('newTrip.baseCurrency')}
        options={CURRENCIES.map((c) => ({ value: c, label: `${c} · ${currencyName(c, locale)}` }))}
        value={draft.baseCurrency}
        onSelect={(c) => {
          set('baseCurrency', c)
          setPickingCurrency(false)
        }}
        onClose={() => setPickingCurrency(false)}
      />
    </Sheet>
  )
}
