import { convertToBaseMinor, decimalsOf, fromMinor, type Expense, type Trip } from '@billing/core'
import type { Snapshot } from './types'

/**
 * UTF-8 BOM。沒有它，Excel 會把 UTF-8 的 CSV 當成本機編碼開啟，
 * 中文的說明與類別全部變成亂碼。
 */
const BOM = '\uFEFF'

/**
 * 會被試算表當成公式開頭的字元。說明欄若是 `=HYPERLINK("http://…")`，
 * 使用者開檔時它會被執行（CSV 公式注入）。在前面加一個單引號，
 * 試算表就把它當純文字顯示。
 */
const FORMULA_START = /^[=+\-@\t\r]/

/** 一格的內容。數字原樣輸出（負數不能被當成公式而加上引號） */
export function csvCell(value: string | number): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** RFC 4180：CRLF 換行，開頭加 BOM */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','))
  return BOM + lines.join('\r\n') + '\r\n'
}

/**
 * 把 id 換成人看得懂的名字。內建類別的名稱要走 i18n，所以由呼叫端提供。
 * 帶上那一筆所屬的旅程：旅程專用的類別與付款方式（task#92、#114）只在那趟旅程裡查得到（task#117）
 */
export interface CsvNames {
  category: (id: string, trip: Trip | undefined) => string
  paymentMethod: (id: string, trip: Trip | undefined) => string
}

const memberName = (trip: Trip | undefined, id: string) => trip?.members.find((m) => m.id === id)?.name ?? id

/** 本位幣金額，換算走 core 的同一條管線，與畫面上看到的數字一致 */
function baseAmount(record: { amount: number; exchangeRate: number }, trip: Trip | undefined): number | string {
  if (!trip) return ''
  const minor = convertToBaseMinor(record.amount, record.exchangeRate, trip.baseCurrency)
  return fromMinor(minor, decimalsOf(trip.baseCurrency))
}

function participantsOf(expense: Expense): string[] {
  const split = expense.split
  if (split.mode === 'even') return split.participants
  if (split.mode === 'exact') return Object.keys(split.amounts)
  return [...new Set(split.items.flatMap((item) => item.participants))]
}

/**
 * 三份分析用的 CSV（規格 13.2.1）。CSV 只供分析、不能匯入，所以軟刪除的紀錄
 * 不列出——使用者要看的是「現在的帳」，不是墓碑。
 */
export function buildCsvFiles(snapshot: Snapshot, names: CsvNames): Record<string, string> {
  const trips = new Map(snapshot.trips.map((t) => [t.id, t]))
  const live = <T extends { deletedAt?: string }>(rows: readonly T[]) => rows.filter((r) => !r.deletedAt)

  const expenses = live(snapshot.expenses)
  const expensesCsv = toCsv(
    ['trip', 'date', 'description', 'category', 'payment_method', 'paid_by', 'amount', 'currency', 'exchange_rate', 'base_amount', 'base_currency', 'split_mode', 'participants', 'draft'],
    expenses.map((e) => {
      const trip = trips.get(e.tripId)
      return [
        trip?.name ?? e.tripId,
        e.date,
        e.description,
        names.category(e.categoryId, trip),
        names.paymentMethod(e.paymentMethodId, trip),
        memberName(trip, e.paidBy),
        e.amount,
        e.currency,
        e.exchangeRate,
        baseAmount(e, trip),
        trip?.baseCurrency ?? '',
        e.split.mode,
        participantsOf(e).map((id) => memberName(trip, id)).join(' / '),
        // task#108：草稿照列出，另外標示；它不算進 app 裡的任何總額
        e.draft ? 'yes' : '',
      ]
    }),
  )

  const itemsCsv = toCsv(
    ['trip', 'date', 'expense', 'item', 'amount', 'currency', 'participants'],
    expenses.flatMap((e) => {
      if (e.split.mode !== 'items') return []
      const trip = trips.get(e.tripId)
      return e.split.items.map((item, index) => [
        trip?.name ?? e.tripId,
        e.date,
        e.description,
        // 規格 2.3：品項名可留空，顯示為「品項 N」
        item.name || `#${index + 1}`,
        item.amount,
        e.currency,
        item.participants.map((id) => memberName(trip, id)).join(' / '),
      ])
    }),
  )

  const transfersCsv = toCsv(
    ['trip', 'date', 'from', 'to', 'amount', 'currency', 'exchange_rate', 'base_amount', 'base_currency', 'kind', 'note', 'draft'],
    live(snapshot.transfers).map((t) => {
      const trip = trips.get(t.tripId)
      return [
        trip?.name ?? t.tripId,
        t.date,
        memberName(trip, t.from),
        memberName(trip, t.to),
        t.amount,
        t.currency,
        t.exchangeRate,
        baseAmount(t, trip),
        trip?.baseCurrency ?? '',
        t.kind,
        t.note,
        t.draft ? 'yes' : '',
      ]
    }),
  )

  return { 'expenses.csv': expensesCsv, 'items.csv': itemsCsv, 'transfers.csv': transfersCsv }
}
