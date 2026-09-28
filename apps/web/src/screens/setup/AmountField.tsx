import { CalcKeypad } from '@billing/ui'
import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

export interface AmountFieldProps {
  label: string
  /** undefined 顯示「未設定」 */
  value: number | undefined
  /** 小數位數：本位幣金額用幣別的位數，匯率給足夠的位數 */
  decimals: number
  /** 算式結果至少寫幾位小數，預設等於 decimals（task#136） */
  minDecimals?: number
  format: (value: number) => string
  /** 清空後按完成回 undefined（規格 2.2：未設就是 undefined，不是 0） */
  onChange: (value: number | undefined) => void
  /**
   * 給一個新物件就以它的算式打開鍵盤（「抓市場匯率」用）。用物件而不是字串：
   * 連抓兩次得到同一個值時，字串相同會被當成沒變。
   */
  autoOpen?: { expression: string }
  /** 鍵盤上方、欄位名稱之後的補充說明 */
  note?: string
}

/**
 * 一列金額，點開計算機鍵盤（規格 5.2：不用原生數字鍵盤）。
 * 按「完成」才回傳並收起，中途的算式不會寫進資料。
 */
export function AmountField({ label, value, decimals, minDecimals, format, onChange, autoOpen, note }: AmountFieldProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [expression, setExpression] = useState('')
  const [handled, setHandled] = useState(autoOpen)

  if (autoOpen !== handled) {
    setHandled(autoOpen)
    if (autoOpen) {
      setExpression(autoOpen.expression)
      setOpen(true)
    }
  }

  const start = () => {
    setExpression(value === undefined ? '' : String(value))
    setOpen(true)
  }

  return (
    <>
      <button type="button" className="app-row" aria-expanded={open} onClick={start}>
        <span>{label}</span>
        <span className="app-row__value app-money">{value === undefined ? t('budget.notSet') : format(value)}</span>
      </button>
      <CalcKeypad
        open={open}
        expression={expression}
        decimals={decimals}
        minDecimals={minDecimals}
        onExpressionChange={setExpression}
        onDone={(result) => {
          setOpen(false)
          onChange(result ?? undefined)
        }}
        labels={{ done: t('keypad.done'), clear: t('keypad.clear'), backspace: t('keypad.backspace') }}
        // 鍵盤蓋住了畫面下半部，上方說明現在在改哪一個欄位
        header={
          <span>
            {label}
            {note ? ` · ${note}` : null}
          </span>
        }
      />
    </>
  )
}
