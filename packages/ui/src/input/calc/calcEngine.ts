export const OPERATORS = ['+', '−', '×', '÷'] as const
export type Operator = (typeof OPERATORS)[number]

export type CalcKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '000' | '.' | Operator | 'back' | 'clear'

export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'divide-by-zero' | 'overflow' }

/** 整數部分上限。12 位已經是一兆，夠任何一筆旅費，也遠在浮點數精確範圍內 */
const MAX_INT_DIGITS = 12

const PRECEDENCE: Record<Operator, number> = { '+': 1, '−': 1, '×': 2, '÷': 2 }

/** 外部貼上或測試用的 ASCII 運算子一律正規化成鍵盤上的字元 */
const ASCII: Record<string, Operator> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

function isOperator(ch: string): ch is Operator {
  return (OPERATORS as readonly string[]).includes(ch)
}

/** 最後一個運算子之後、正在輸入的那個數字 */
function currentNumber(expr: string): string {
  let i = expr.length
  while (i > 0 && !isOperator(expr[i - 1]!)) i -= 1
  return expr.slice(i)
}

/**
 * 按下一個鍵之後運算式變成什麼。
 *
 * 所有「輸入不合法」的情況都在這裡擋掉，所以鍵盤永遠不會產生 evaluate
 * 看不懂的東西。
 */
export function appendKey(expr: string, key: CalcKey, decimals: number): string {
  if (key === 'clear') return ''
  if (key === 'back') return expr.slice(0, -1)

  if (isOperator(key)) {
    if (expr === '') return expr
    // 12. 後面接運算子時丟掉孤零零的小數點
    const trimmed = expr.endsWith('.') ? expr.slice(0, -1) : expr
    const last = trimmed.at(-1)
    if (last !== undefined && isOperator(last)) return trimmed.slice(0, -1) + key
    return trimmed + key
  }

  const num = currentNumber(expr)

  if (key === '.') {
    if (decimals === 0 || num.includes('.')) return expr
    return expr + (num === '' ? '0.' : '.')
  }

  if (key === '000') {
    // 空的或只有 0 時按 000 會產生前導零
    if (num === '' || num === '0') return expr
    let next = expr
    for (let i = 0; i < 3; i += 1) next = appendKey(next, '0', decimals)
    return next
  }

  const [intPart = '', frac] = num.split('.')
  if (frac !== undefined) return frac.length >= decimals ? expr : expr + key
  if (intPart === '0') return expr.slice(0, -1) + key
  if (intPart.length >= MAX_INT_DIGITS) return expr
  return expr + key
}

function tokenize(expr: string): (number | Operator)[] | null {
  const tokens: (number | Operator)[] = []
  let num = ''
  const pushNumber = () => {
    if (!/^\d+(\.\d*)?$/.test(num)) return false
    tokens.push(Number(num))
    num = ''
    return true
  }
  for (const raw of expr.replace(/[\s,]/g, '')) {
    const ch = ASCII[raw] ?? raw
    if (isOperator(ch)) {
      if (num === '' || !pushNumber()) return null
      tokens.push(ch)
    } else if (/[\d.]/.test(ch)) {
      num += ch
    } else {
      return null
    }
  }
  if (num !== '' && !pushNumber()) return null
  return tokens
}

function apply(op: Operator, a: number, b: number): number {
  switch (op) {
    case '+':
      return a + b
    case '−':
      return a - b
    case '×':
      return a * b
    case '÷':
      return a / b
  }
}

/**
 * 求值並四捨五入到 decimals 位。不用 eval、不用 new Function。
 */
export function evaluate(expr: string, decimals: number): EvalResult {
  // 空字串與只剩運算子要先判斷：它們在 tokenize 裡會被當成不合法，
  // 但對使用者來說那是「還沒輸入」，不是「輸入錯了」
  const compact = expr.replace(/[\s,]/g, '')
  if (compact === '' || [...compact].every((c) => isOperator(ASCII[c] ?? c))) {
    return { ok: false, reason: 'empty' }
  }

  const tokens = tokenize(expr)
  if (!tokens) return { ok: false, reason: 'invalid' }
  // 規格 5.3：式尾掛著運算子時直接丟棄
  if (tokens.length > 0 && typeof tokens.at(-1) !== 'number') tokens.pop()
  if (tokens.length === 0) return { ok: false, reason: 'empty' }

  const output: (number | Operator)[] = []
  const ops: Operator[] = []
  for (const token of tokens) {
    if (typeof token === 'number') {
      output.push(token)
      continue
    }
    while (ops.length > 0 && PRECEDENCE[ops.at(-1)!] >= PRECEDENCE[token]) output.push(ops.pop()!)
    ops.push(token)
  }
  while (ops.length > 0) output.push(ops.pop()!)

  const stack: number[] = []
  for (const token of output) {
    if (typeof token === 'number') {
      stack.push(token)
      continue
    }
    const b = stack.pop()
    const a = stack.pop()
    if (a === undefined || b === undefined) return { ok: false, reason: 'invalid' }
    if (token === '÷' && b === 0) return { ok: false, reason: 'divide-by-zero' }
    stack.push(apply(token, a, b))
  }
  const value = stack[0]
  if (value === undefined || stack.length !== 1) return { ok: false, reason: 'invalid' }

  const scale = 10 ** decimals
  // toPrecision(12) 先壓掉浮點數雜訊，與 core 的 toMinor 同一個做法
  const scaled = Number((value * scale).toPrecision(12))
  if (!Number.isFinite(scaled) || Math.abs(scaled) > Number.MAX_SAFE_INTEGER) {
    return { ok: false, reason: 'overflow' }
  }
  return { ok: true, value: Math.round(scaled) / scale }
}

/** 顯示用：千分位、運算子前後留空格。小數部分不分組 */
export function formatExpression(expr: string): string {
  return expr
    .replace(/\d+(\.\d*)?/g, (match) => {
      const [int = '', frac] = match.split('.')
      const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return frac === undefined ? grouped : `${grouped}.${frac}`
    })
    .replace(/[+−×÷]/g, (op) => ` ${op} `)
    .trim()
}

/** 結果顯示用：千分位、固定小數位數 */
export function formatResult(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
