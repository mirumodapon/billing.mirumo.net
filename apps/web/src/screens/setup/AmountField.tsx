import { CalcKeypad } from '@billing/ui'
import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

export interface AmountFieldProps {
  label: string
  /** undefined 顯示「未設定」 */
  value: number | undefined
  /** 小數位數：本位幣金額用幣別的位數，匯率給足夠的位數 */
  decimals: number
  format: (value: number) => string
  /** 清空後按完成回 undefined（規格 2.2：未設就是 undefined，不是 0） */
  onChange: (value: number | undefined) => void
}

/**
 * 一列金額，點開計算機鍵盤（規格 5.2：不用原生數字鍵盤）。
 * 按「完成」才回傳並收起，中途的算式不會寫進資料。
 */
export function AmountField({ label, value, decimals, format, onChange }: AmountFieldProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [expression, setExpression] = useState('')

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
        onExpressionChange={setExpression}
        onDone={(result) => {
          setOpen(false)
          onChange(result ?? undefined)
        }}
        labels={{ done: t('keypad.done'), clear: t('keypad.clear'), backspace: t('keypad.backspace') }}
        // 鍵盤蓋住了畫面下半部，上方說明現在在改哪一個欄位
        header={<span>{label}</span>}
      />
    </>
  )
}
