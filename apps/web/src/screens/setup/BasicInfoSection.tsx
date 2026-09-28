import type { Trip } from '@billing/core'
import { Accordion, SheetPicker, TextField } from '@billing/ui'
import { useState } from 'react'
import { CURRENCIES, currencyName } from '../../domain/currencies'
import { useI18n } from '../../i18n/useI18n'
import { DateRangeField } from '../forms/DateRangeField'

export interface BasicInfoSectionProps {
  trip: Trip
  hasRecords: boolean
  open: boolean
  onToggle: () => void
  save: (change: (t: Trip) => Trip) => Promise<Trip | undefined>
}

/**
 * 名稱、目的地、日期、本位幣（規格 4.7）。文字欄位失焦才存：每次存檔都會蓋
 * updatedAt、觸發列表重排，每按一個鍵存一次沒有意義。
 */
export function BasicInfoSection({ trip, hasRecords, open, onToggle, save }: BasicInfoSectionProps) {
  const { t, locale, dateRange } = useI18n()
  const [name, setName] = useState(trip.name)
  const [destination, setDestination] = useState(trip.destination)
  const [nameError, setNameError] = useState(false)
  const [pickingCurrency, setPickingCurrency] = useState(false)

  const saveName = () => {
    const trimmed = name.trim()
    setNameError(!trimmed)
    if (trimmed && trimmed !== trip.name) void save((x) => ({ ...x, name: trimmed }))
  }
  const saveDestination = () => {
    const trimmed = destination.trim()
    if (trimmed !== trip.destination) void save((x) => ({ ...x, destination: trimmed }))
  }

  const summary = [trip.destination, dateRange(trip.startDate, trip.endDate), trip.baseCurrency].filter(Boolean).join(' · ')

  return (
    <Accordion title={t('setup.basic')} summary={summary} open={open} onToggle={onToggle} data-testid="section-basic">
      <div className="app-form">
        <TextField
          label={t('newTrip.name')}
          value={name}
          onChange={setName}
          onBlur={saveName}
          error={nameError ? t('newTrip.nameRequired') : undefined}
        />
        <TextField label={t('newTrip.destination')} value={destination} onChange={setDestination} onBlur={saveDestination} />
        {/* 一個月曆點兩下設好出發與回程（task#126）：點的先後不拘，存進來的一定是先早後晚 */}
        <DateRangeField
          label={t('newTrip.dates')}
          start={trip.startDate}
          end={trip.endDate}
          onChange={(startDate, endDate) => void save((x) => ({ ...x, startDate, endDate }))}
        />
        {hasRecords ? (
          <div>
            <p className="app-field-label">{t('newTrip.baseCurrency')}</p>
            <p className="m-0">{trip.baseCurrency}</p>
            <p className="app-field-label mt-1">{t('setup.baseCurrencyLocked')}</p>
          </div>
        ) : (
          <button type="button" className="app-row" aria-haspopup="dialog" onClick={() => setPickingCurrency(true)}>
            <span>{t('newTrip.baseCurrency')}</span>
            <span className="app-row__value">{trip.baseCurrency}</span>
          </button>
        )}
      </div>
      <SheetPicker
        open={pickingCurrency}
        title={t('newTrip.baseCurrency')}
        options={CURRENCIES.map((c) => ({ value: c, label: `${c} · ${currencyName(c, locale)}` }))}
        value={trip.baseCurrency}
        onSelect={(c) => {
          setPickingCurrency(false)
          if (c !== trip.baseCurrency) void save((x) => ({ ...x, baseCurrency: c }))
        }}
        onClose={() => setPickingCurrency(false)}
      />
    </Accordion>
  )
}
