import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { formatExpression } from './calc/calcEngine'
import { CalcKeypad } from './CalcKeypad'

const labels = { done: '完成', clear: '清除', backspace: '刪除一位' }

function Harness({ decimals = 0, onDone = vi.fn() }: { decimals?: number; onDone?: (v: number | null) => void }) {
  const [expr, setExpr] = useState('')
  return (
    <div>
      <input aria-label="金額" inputMode="none" readOnly />
      <CalcKeypad
        open
        expression={expr}
        decimals={decimals}
        onExpressionChange={setExpr}
        onDone={onDone}
        labels={labels}
      />
    </div>
  )
}

async function tap(...names: string[]) {
  for (const name of names) await userEvent.click(screen.getByRole('button', { name }))
}

describe('CalcKeypad', () => {
  it('renders nothing when closed', () => {
    render(
      <CalcKeypad
        open={false}
        expression=""
        decimals={0}
        onExpressionChange={vi.fn()}
        onDone={vi.fn()}
        labels={labels}
      />,
    )
    expect(screen.queryByRole('button', { name: '7' })).not.toBeInTheDocument()
  })

  it('shows the expression as it is typed, grouped for reading', async () => {
    render(<Harness />)
    await tap('1', '2', '0', '0', '+', '8', '0', '0')
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('1,200 + 800')
  })

  it('previews the result while typing', async () => {
    render(<Harness />)
    await tap('1', '2', '0', '0', '+', '8', '0', '0', '×', '2')
    expect(screen.getByTestId('calc-result')).toHaveTextContent('2,800')
  })

  // 規格 5.3：完成同時扮演 =
  it('reports the evaluated amount on done', async () => {
    const onDone = vi.fn()
    render(<Harness onDone={onDone} />)
    await tap('9', '0', '0', '÷', '3', '完成')
    expect(onDone).toHaveBeenCalledWith(300)
  })

  // task#95：= 只求值、把算式換成結果，鍵盤留著可以接著算
  it('replaces the expression with its result on =, keeping the keypad open', async () => {
    const onDone = vi.fn()
    render(<Harness onDone={onDone} />)
    await tap('1', '2', '0', '0', '+', '8', '0', '0', '×', '2', '=')
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('2,800')
    expect(onDone).not.toHaveBeenCalled()
    await tap('+', '2', '0', '0', '=')
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('3,000')
  })

  it('leaves an expression that cannot be worked out as it is on =', async () => {
    render(<Harness />)
    await tap('5', '÷', '0', '=')
    expect(screen.getByTestId('calc-expression')).toHaveTextContent(formatExpression('5÷0'))
  })

  it('reports null when done is pressed with nothing typed', async () => {
    const onDone = vi.fn()
    render(<Harness onDone={onDone} />)
    await tap('完成')
    expect(onDone).toHaveBeenCalledWith(null)
  })

  // 除以零時不能把 Infinity 或 0 當成金額交出去
  it('disables done while the expression cannot be evaluated', async () => {
    render(<Harness />)
    await tap('5', '÷', '0')
    expect(screen.getByRole('button', { name: '完成' })).toBeDisabled()
  })

  // 規格 5.3：零小數幣別的小數點從源頭灰掉
  it('disables the decimal point for a zero-decimal currency', () => {
    render(<Harness decimals={0} />)
    expect(screen.getByRole('button', { name: '.' })).toBeDisabled()
  })

  it('enables the decimal point for a two-decimal currency', () => {
    render(<Harness decimals={2} />)
    expect(screen.getByRole('button', { name: '.' })).toBeEnabled()
  })

  // 退格鍵只有圖示，名稱必須由 labels 給
  it('names the icon-only backspace key', async () => {
    render(<Harness />)
    await tap('1', '2', '刪除一位')
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('1')
  })

  it('clears with C', async () => {
    render(<Harness />)
    await tap('1', '2', '清除')
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('')
  })

  /*
   * 按鍵不能搶走金額欄位的焦點。金額欄位失焦時 app 會把鍵盤收掉，所以一按
   * 就失焦等於鍵盤一按就消失。
   */
  it('does not steal focus from the field it is typing into', async () => {
    render(<Harness />)
    const field = screen.getByRole('textbox', { name: '金額' })
    field.focus()
    await tap('7')
    expect(field).toHaveFocus()
  })

  it('announces the result politely as it changes', () => {
    render(<Harness />)
    expect(screen.getByTestId('calc-result')).toHaveAttribute('aria-live', 'polite')
  })

  it('gives every key a full tap target and sits on the keypad layer', () => {
    const css = readFileSync(join(import.meta.dirname, 'CalcKeypad.css'), 'utf8')
    expect(css).toMatch(/\.bi-keypad__key\s*{[^}]*min-height:\s*var\(--bi-tap-min\)/)
    expect(css).toMatch(/z-index:\s*var\(--bi-z-keypad\)/)
  })
})
