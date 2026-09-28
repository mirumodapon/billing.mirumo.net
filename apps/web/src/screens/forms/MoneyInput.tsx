import { convertToBaseMinor, decimalsOf } from '@billing/core'
import { Button, CalcKeypad, evaluate, Icon, SheetPicker } from '@billing/ui'
import { IconChevronDown, IconPencil } from '@tabler/icons-react'
import { useId, useState } from 'react'
import { CURRENCIES, currencyName } from '../../domain/currencies'
import { useI18n } from '../../i18n/useI18n'

/** 匯率給足夠的位數：0.0235 韓圜 */
const RATE_DECIMALS = 6

/**
 * 幣別、金額、換算（規格 4.4 常駐的第一塊）。支出與轉帳表單共用。版面照規格的示意：幣別貼在金額左邊，
 * 換算與匯率只佔一行——多出來的每一列都會把說明欄往下推到鍵盤底下。
 *
 * 金額欄位是 readOnly + inputMode="none"：保留焦點與無障礙語意，但不喚起系統鍵盤
 * （規格 5.3）。金額隨算式即時更新，不等「完成」：輸入 3800 後直接點說明欄的人，
 * 金額不能不見。
 */
export interface MoneyInputProps {
  baseCurrency: string
  currency: string
  amount: number | undefined
  exchangeRate: number | undefined
  autoFocus: boolean
  onAmount: (amount: number | undefined) => void
  /** 換幣別。匯率要不要跟著重新帶入由呼叫端決定（手動改過的不覆寫） */
  onCurrency: (currency: string) => void
  onManualRate: (rate: number | undefined) => void
}

export function MoneyInput({ baseCurrency, currency, amount, exchangeRate, autoFocus, onAmount, onCurrency, onManualRate }: MoneyInputProps) {
  const { t, locale, money } = useI18n()
  const id = useId()
  const [keypad, setKeypad] = useState<'amount' | 'rate' | null>(null)
  const [expression, setExpression] = useState(() => (amount === undefined ? '' : String(amount)))
  const [rateExpression, setRateExpression] = useState('')
  const [pickingCurrency, setPickingCurrency] = useState(false)
  const decimals = decimalsOf(currency)
  const foreign = currency !== baseCurrency

  const onExpression = (next: string) => {
    setExpression(next)
    const result = evaluate(next, decimals)
    if (result.ok) onAmount(result.value)
    else if (result.reason === 'empty') onAmount(undefined)
  }

  const converted =
    amount !== undefined && exchangeRate !== undefined
      ? money(convertToBaseMinor(amount, exchangeRate, baseCurrency), baseCurrency)
      : undefined
  const rateText = exchangeRate?.toLocaleString(locale, { maximumFractionDigits: RATE_DECIMALS })
  const currencies = [baseCurrency, ...CURRENCIES.filter((c) => c !== baseCurrency)]
  const labels = { done: t('keypad.done'), clear: t('keypad.clear'), backspace: t('keypad.backspace') }

  return (
    <section className="flex flex-col gap-1">
      <label htmlFor={id} className="bi-visually-hidden">
        {t('expense.amount')}
      </label>
      <div className="app-amount-row">
        <button
          type="button"
          className="app-currency"
          aria-haspopup="dialog"
          aria-label={t('expense.pickCurrency', { currency: currency })}
          onClick={() => setPickingCurrency(true)}
        >
          {currency}
          <Icon glyph={IconChevronDown} size="sm" />
        </button>
        <input
          id={id}
          className="app-amount"
          readOnly
          inputMode="none"
          autoFocus={autoFocus}
          value={expression}
          onFocus={() => setKeypad('amount')}
          // 焦點移到別的欄位（說明、系統鍵盤）時自製鍵盤收起，兩者永不同時出現
          onBlur={() => setKeypad((k) => (k === 'amount' ? null : k))}
        />
      </div>
      {foreign ? (
        <div className="app-converted">
          <span aria-live="polite">
            {/* 「沒有匯率」只看匯率本身：還沒輸入金額時也算不出換算，但那不是沒有匯率 */}
            {rateText === undefined
              ? t('expense.noRate', { currency: currency })
              : [converted && t('expense.converted', { amount: converted }), t('expense.rateInline', { rate: rateText })].filter(Boolean).join(' ・')}
          </span>
          <Button
            variant="ghost"
            aria-label={t('expense.editRate')}
            onClick={() => {
              setRateExpression(exchangeRate === undefined ? '' : String(exchangeRate))
              setKeypad('rate')
            }}
          >
            <Icon glyph={IconPencil} />
          </Button>
        </div>
      ) : null}
      <CalcKeypad
        open={keypad === 'amount'}
        expression={expression}
        decimals={decimals}
        onExpressionChange={onExpression}
        onDone={() => {
          setKeypad(null)
          // 收起後把欄位的算式換成結果：1200+800×2 → 2800
          setExpression((e) => {
            const result = evaluate(e, decimals)
            return result.ok ? String(result.value) : ''
          })
          ;(document.activeElement as HTMLElement | null)?.blur()
        }}
        labels={labels}
        header={
          <span className="app-money">
            {currency}
            {foreign && converted ? ` · ${t('expense.converted', { amount: converted })}` : null}
          </span>
        }
      />
      <CalcKeypad
        open={keypad === 'rate'}
        expression={rateExpression}
        decimals={RATE_DECIMALS}
        onExpressionChange={setRateExpression}
        onDone={(rate) => {
          setKeypad(null)
          onManualRate(rate ?? undefined)
        }}
        labels={labels}
        header={<span className="app-money">{`1 ${currency} = ? ${baseCurrency}`}</span>}
      />
      <SheetPicker
        open={pickingCurrency}
        title={t('expense.currency')}
        options={currencies.map((c) => ({ value: c, label: `${c} · ${currencyName(c, locale)}` }))}
        value={currency}
        onSelect={(next) => {
          setPickingCurrency(false)
          onCurrency(next)
          // 換成零小數的幣別時，算式裡的小數要重算一次，免得欄位顯示 12.5 日圓
          const result = evaluate(expression, decimalsOf(next))
          if (result.ok) {
            setExpression(String(result.value))
            onAmount(result.value)
          }
        }}
        onClose={() => setPickingCurrency(false)}
      />
    </section>
  )
}
