import { convertToBaseMinor, decimalsOf } from '@billing/core'
import { CalcKeypad, evaluate, SheetPicker } from '@billing/ui'
import { useId, useState } from 'react'
import { CURRENCIES, currencyName } from '../../domain/currencies'
import { withAutoRate, withManualRate } from '../../domain/expenseDraft'
import { useI18n } from '../../i18n/useI18n'
import { AmountField } from '../setup/AmountField'
import type { FormSectionProps } from './ExpenseFormScreen'

/** 匯率給足夠的位數：0.0235 韓圜 */
const RATE_DECIMALS = 6

/**
 * 幣別、金額、換算（規格 4.4 常駐的第一塊）。
 *
 * 金額欄位是 readOnly + inputMode="none"：保留焦點與無障礙語意，但不喚起系統鍵盤
 * （規格 5.3）。金額隨算式即時更新，不等「完成」：輸入 3800 後直接點說明欄的人，
 * 金額不能不見。
 */
export function AmountSection({ trip, draft, change, autoFocus }: FormSectionProps & { autoFocus: boolean }) {
  const { t, locale, money } = useI18n()
  const id = useId()
  const [keypad, setKeypad] = useState(false)
  const [expression, setExpression] = useState(() => (draft.amount === undefined ? '' : String(draft.amount)))
  const [pickingCurrency, setPickingCurrency] = useState(false)
  const decimals = decimalsOf(draft.currency)
  const foreign = draft.currency !== trip.baseCurrency

  const onExpression = (next: string) => {
    setExpression(next)
    const result = evaluate(next, decimals)
    if (result.ok) change((d) => ({ ...d, amount: result.value }))
    else if (result.reason === 'empty') change((d) => ({ ...d, amount: undefined }))
  }

  const converted =
    draft.amount !== undefined && draft.exchangeRate !== undefined
      ? money(convertToBaseMinor(draft.amount, draft.exchangeRate, trip.baseCurrency), trip.baseCurrency)
      : undefined
  const currencies = [trip.baseCurrency, ...CURRENCIES.filter((c) => c !== trip.baseCurrency)]

  return (
    <section className="flex flex-col gap-2">
      <button type="button" className="app-row" aria-haspopup="dialog" onClick={() => setPickingCurrency(true)}>
        <span>{t('expense.currency')}</span>
        <span className="app-row__value">{draft.currency}</span>
      </button>
      <label htmlFor={id} className="app-field-label">
        {t('expense.amount')}
      </label>
      <input
        id={id}
        className="app-amount"
        readOnly
        inputMode="none"
        autoFocus={autoFocus}
        value={expression}
        onFocus={() => setKeypad(true)}
        // 焦點移到別的欄位（說明、系統鍵盤）時自製鍵盤收起，兩者永不同時出現
        onBlur={() => setKeypad(false)}
      />
      {foreign ? (
        <>
          <p className="app-field-label app-money" aria-live="polite">
            {converted ? t('expense.converted', { amount: converted }) : t('expense.noRate', { currency: draft.currency })}
          </p>
          <AmountField
            label={t('expense.rate')}
            value={draft.exchangeRate}
            decimals={RATE_DECIMALS}
            format={(v) => v.toLocaleString(locale, { maximumFractionDigits: RATE_DECIMALS })}
            onChange={(rate) => change((d) => withManualRate(d, rate))}
          />
        </>
      ) : null}
      <CalcKeypad
        open={keypad}
        expression={expression}
        decimals={decimals}
        onExpressionChange={onExpression}
        onDone={() => {
          setKeypad(false)
          // 收起後把欄位的算式換成結果：1200+800×2 → 2800
          setExpression((e) => {
            const result = evaluate(e, decimals)
            return result.ok ? String(result.value) : ''
          })
          ;(document.activeElement as HTMLElement | null)?.blur()
        }}
        labels={{ done: t('keypad.done'), clear: t('keypad.clear'), backspace: t('keypad.backspace') }}
        header={
          <span className="app-money">
            {draft.currency}
            {foreign && converted ? ` · ${t('expense.converted', { amount: converted })}` : null}
          </span>
        }
      />
      <SheetPicker
        open={pickingCurrency}
        title={t('expense.currency')}
        options={currencies.map((c) => ({ value: c, label: `${c} · ${currencyName(c, locale)}` }))}
        value={draft.currency}
        onSelect={(currency) => {
          setPickingCurrency(false)
          change((d) => withAutoRate({ ...d, currency }, trip))
          // 換成零小數的幣別時，算式裡的小數要重算一次，免得欄位顯示 12.5 日圓
          const result = evaluate(expression, decimalsOf(currency))
          if (result.ok) {
            setExpression(String(result.value))
            change((d) => ({ ...d, amount: result.value }))
          }
        }}
        onClose={() => setPickingCurrency(false)}
      />
    </section>
  )
}
