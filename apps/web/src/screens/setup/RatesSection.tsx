import { rateKey, type ExchangeRateTable, type Trip } from '@billing/core'
import { Accordion, Button, Icon, SheetPicker } from '@billing/ui'
import { IconRefresh, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { CURRENCIES, currencyName } from '../../domain/currencies'
import { fetchRate } from '../../domain/fetchRate'
import { displayName } from '../../domain/names'
import { paymentMethodsFor } from '../../domain/paymentMethods'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores } from '../../stores/StoresProvider'
import { useConfirmDelete } from '../forms/useConfirmDelete'
import { AmountField } from './AmountField'

export interface RatesSectionProps {
  trip: Trip
  open: boolean
  onToggle: () => void
  save: (change: (t: Trip) => Trip) => Promise<Trip | undefined>
}

/** 匯率要多少位小數都給得起：0.0235 韓圜、0.2128 日圓 */
const RATE_DECIMALS = 6

const currencyOf = (key: string) => key.split('|')[0]!
const methodOf = (key: string) => key.split('|')[1]!

/** 值為 undefined 就移除那個 key：沒有匯率就是沒有，不能存 0（resolveRate 靠 undefined 分辨「留白」） */
function setEntry(table: Record<string, number>, key: string, value: number | undefined): Record<string, number> {
  const next = { ...table }
  if (value === undefined) delete next[key]
  else next[key] = value
  return next
}

function currenciesIn(rates: ExchangeRateTable): string[] {
  const all = new Set([...Object.keys(rates.default), ...Object.keys(rates.byMethod).map(currencyOf)])
  // 依常用度排，而不是依加入順序：卡片的位置不該因為先設了哪個而跳來跳去
  return [...all].sort((a, b) => CURRENCIES.indexOf(a) - CURRENCIES.indexOf(b))
}

/**
 * 匯率表（規格 4.7）：每個幣別一張卡片，卡內是預設匯率與各付款方式的匯率。
 * ↻ 抓到的市場匯率只填進鍵盤供確認，按完成才存。
 */
export function RatesSection({ trip, open, onToggle, save }: RatesSectionProps) {
  const { t, tPlural, locale } = useI18n()
  const { ui } = useStores()
  const globalMethods = useSettings((s) => s.settings.paymentMethods)
  const methods = paymentMethodsFor(globalMethods, trip)
  // 剛加入、還沒輸入任何匯率的幣別與付款方式：沒有值就不存，所以先放在畫面上
  const [addedCurrencies, setAddedCurrencies] = useState<string[]>([])
  const [addedMethods, setAddedMethods] = useState<string[]>([])
  const [picker, setPicker] = useState<{ kind: 'currency' } | { kind: 'method'; currency: string } | null>(null)
  const [fetched, setFetched] = useState<{ currency: string; autoOpen: { expression: string } } | null>(null)
  const confirm = useConfirmDelete()

  const saved = currenciesIn(trip.rates)
  const currencies = [...saved, ...addedCurrencies.filter((c) => !saved.includes(c))]
  const format = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: RATE_DECIMALS })
  const methodName = (id: string) => {
    const method = methods.find((m) => m.id === id)
    return method ? displayName(method) : id
  }

  const setDefault = (currency: string) => (value: number | undefined) =>
    void save((x) => ({ ...x, rates: { ...x.rates, default: setEntry(x.rates.default, currency, value) } }))
  const setMethod = (key: string) => (value: number | undefined) =>
    void save((x) => ({ ...x, rates: { ...x.rates, byMethod: setEntry(x.rates.byMethod, key, value) } }))

  const removeCurrency = (currency: string) => {
    setAddedCurrencies((list) => list.filter((c) => c !== currency))
    setAddedMethods((list) => list.filter((k) => currencyOf(k) !== currency))
    void save((x) => {
      const byMethod = Object.fromEntries(Object.entries(x.rates.byMethod).filter(([k]) => currencyOf(k) !== currency))
      return { ...x, rates: { default: setEntry(x.rates.default, currency, undefined), byMethod } }
    })
  }

  const fetchMarket = async (currency: string) => {
    const result = await fetchRate(currency, trip.baseCurrency)
    if (result.ok) setFetched({ currency, autoOpen: { expression: String(result.rate) } })
    else ui.getState().show({ id: 'fx', message: t(`rates.${result.reason}`) })
  }

  const pickerOptions =
    picker?.kind === 'currency'
      ? CURRENCIES.filter((c) => c !== trip.baseCurrency && !currencies.includes(c)).map((c) => ({
          value: c,
          label: `${c} · ${currencyName(c, locale)}`,
        }))
      : picker?.kind === 'method'
        ? methods
            .filter((m) => {
              const key = rateKey(picker.currency, m.id)
              return !(key in trip.rates.byMethod) && !addedMethods.includes(key)
            })
            .map((m) => ({ value: m.id, label: displayName(m) }))
        : []

  return (
    <Accordion
      title={t('rates.title')}
      summary={tPlural('rates.count', { count: saved.length })}
      open={open}
      onToggle={onToggle}
      data-testid="section-rates"
    >
      <div className="app-form">
        {currencies.length === 0 ? <p className="app-field-label">{t('rates.empty', { base: trip.baseCurrency })}</p> : null}
        {currencies.map((currency) => {
          const keys = [
            ...Object.keys(trip.rates.byMethod).filter((k) => currencyOf(k) === currency),
            ...addedMethods.filter((k) => currencyOf(k) === currency && !(k in trip.rates.byMethod)),
          ]
          return (
            <section key={currency} aria-label={currency} className="app-card">
              <div className="flex items-center gap-2">
                <h3 className="app-card__title flex-1">{currency}</h3>
                <Button variant="ghost" aria-label={t('rates.fetch', { currency })} onClick={() => void fetchMarket(currency)}>
                  <Icon glyph={IconRefresh} />
                </Button>
                <Button variant="ghost" aria-label={t('rates.removeCurrency', { currency })} onClick={() => confirm.ask(currency, 'permanent', () => removeCurrency(currency))}>
                  <Icon glyph={IconTrash} />
                </Button>
              </div>
              <p className="app-field-label">{t('rates.hint', { currency, base: trip.baseCurrency })}</p>
              <AmountField
                label={t('rates.default')}
                value={trip.rates.default[currency]}
                decimals={RATE_DECIMALS}
                format={format}
                onChange={(v) => {
                  setFetched(null)
                  setDefault(currency)(v)
                }}
                autoOpen={fetched?.currency === currency ? fetched.autoOpen : undefined}
                note={fetched?.currency === currency ? t('rates.fetched') : undefined}
              />
              {keys.map((key) => (
                <AmountField
                  key={key}
                  label={methodName(methodOf(key))}
                  value={trip.rates.byMethod[key]}
                  decimals={RATE_DECIMALS}
                  format={format}
                  onChange={setMethod(key)}
                />
              ))}
              <Button variant="ghost" onClick={() => setPicker({ kind: 'method', currency })}>
                {t('rates.addMethod')}
              </Button>
            </section>
          )
        })}
        <Button variant="secondary" onClick={() => setPicker({ kind: 'currency' })}>
          {t('rates.addCurrency')}
        </Button>
      </div>
      <SheetPicker
        open={picker !== null}
        title={picker?.kind === 'method' ? t('rates.addMethod') : t('rates.addCurrency')}
        options={pickerOptions}
        value=""
        onSelect={(value) => {
          if (picker?.kind === 'currency') setAddedCurrencies((list) => [...list, value])
          if (picker?.kind === 'method') setAddedMethods((list) => [...list, rateKey(picker.currency, value)])
          setPicker(null)
        }}
        onClose={() => setPicker(null)}
      />
      {confirm.dialog}
    </Accordion>
  )
}
