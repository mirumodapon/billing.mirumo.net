import { IconBackspace } from '@tabler/icons-react'
import type { PointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons/Icon'
import { SafeArea } from '../layout/SafeArea'
import { appendKey, evaluate, formatExpression, formatResult, type CalcKey } from './calc/calcEngine'

export interface CalcKeypadLabels {
  done: string
  clear: string
  /** 退格鍵只有圖示，這是它唯一的名稱 */
  backspace: string
}

export interface CalcKeypadProps {
  open: boolean
  expression: string
  /** 幣別的小數位數。0 時小數點鍵停用 */
  decimals: number
  onExpressionChange: (expression: string) => void
  /** 按下完成：算得出來給數值，什麼都沒輸入給 null */
  onDone: (value: number | null) => void
  labels: CalcKeypadLabels
  /** 鍵盤上方的列，由 app 放幣別切換與換算結果 */
  header?: ReactNode
}

// 規格 5.3 的版面，由上而下、由左而右
const ROWS: (CalcKey | 'done')[][] = [
  ['7', '8', '9', 'back'],
  ['4', '5', '6', '÷'],
  ['1', '2', '3', '×'],
  ['.', '0', '000', '−'],
  ['clear', 'done', '+'],
]

/**
 * 按鍵不能搶走焦點：金額欄位失焦時 app 會把鍵盤收掉，所以一按就失焦
 * 等於一按就消失。系統鍵盤也是這樣，按鍵不會變成焦點。
 */
function keepFocus(event: PointerEvent) {
  event.preventDefault()
}

export function CalcKeypad({
  open,
  expression,
  decimals,
  onExpressionChange,
  onDone,
  labels,
  header,
}: CalcKeypadProps) {
  if (!open) return null

  const result = evaluate(expression, decimals)
  const blocked = !result.ok && result.reason !== 'empty'

  function press(key: CalcKey) {
    onExpressionChange(appendKey(expression, key, decimals))
  }

  function done() {
    if (result.ok) onDone(result.value)
    else if (result.reason === 'empty') onDone(null)
  }

  return createPortal(
    <SafeArea edges={['bottom', 'left', 'right']} data-testid="keypad-safe">
      <div className="bi-keypad">
        {header ? <div className="bi-keypad__header">{header}</div> : null}
        <div className="bi-keypad__display">
          <div className="bi-keypad__expression" data-testid="calc-expression">
            {formatExpression(expression)}
          </div>
          <output className="bi-keypad__result" data-testid="calc-result" aria-live="polite">
            {result.ok ? `= ${formatResult(result.value, decimals)}` : ''}
          </output>
        </div>
        <div className="bi-keypad__grid">
          {ROWS.flat().map((key) => {
            if (key === 'done') {
              return (
                <button
                  key="done"
                  type="button"
                  className="bi-keypad__key"
                  data-kind="done"
                  disabled={blocked}
                  onPointerDown={keepFocus}
                  onClick={done}
                >
                  {labels.done}
                </button>
              )
            }
            if (key === 'back') {
              return (
                <button
                  key="back"
                  type="button"
                  className="bi-keypad__key"
                  data-kind="fn"
                  onPointerDown={keepFocus}
                  onClick={() => press('back')}
                >
                  <Icon glyph={IconBackspace} size="lg" ariaLabel={labels.backspace} />
                </button>
              )
            }
            const isOp = key === '+' || key === '−' || key === '×' || key === '÷'
            return (
              <button
                key={key}
                type="button"
                className="bi-keypad__key"
                data-kind={isOp ? 'op' : key === 'clear' ? 'fn' : 'digit'}
                disabled={key === '.' && decimals === 0}
                onPointerDown={keepFocus}
                onClick={() => press(key)}
              >
                {key === 'clear' ? labels.clear : key}
              </button>
            )
          })}
        </div>
      </div>
    </SafeArea>,
    document.body,
  )
}
