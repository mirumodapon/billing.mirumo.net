/**
 * 'YYYY-MM-DD' 字串的日期運算，一律以 UTC 午夜為準。
 *
 * 用本地時間解析的話，UTC 以東的機器上 new Date('2026-03-15') 之類的寫法會
 * 差一天。整個 ui 的日期都走這裡，就不會有第二個地方犯同樣的錯。
 */
const DAY_MS = 86_400_000

export function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function isValidIso(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const date = parseIso(iso)
  // 2026-02-30 會被 Date 默默滾成 3/2，所以要回頭比對
  return !Number.isNaN(date.getTime()) && toIso(date) === iso
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / DAY_MS)
}

/** from 到 to 的每一天，兩端都包含。to 早於 from 時回空陣列 */
export function eachDay(from: string, to: string): string[] {
  const count = daysBetween(from, to)
  if (count < 0) return []
  return Array.from({ length: count + 1 }, (_, i) => addDays(from, i))
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 8)}01`
}

/** 回傳目標月份的一號。先回到一號再加，1/31 加一個月才不會溢位成 3 月 */
export function addMonths(iso: string, months: number): string {
  const date = parseIso(startOfMonth(iso))
  date.setUTCMonth(date.getUTCMonth() + months)
  return toIso(date)
}

/**
 * iso 所在月份，切成每週七格。月初前、月底後的空格是 null。
 *
 * @param weekStart 0 = 星期日開頭，1 = 星期一開頭
 */
export function monthGrid(iso: string, weekStart: 0 | 1): (string | null)[][] {
  const first = startOfMonth(iso)
  const lead = (parseIso(first).getUTCDay() - weekStart + 7) % 7
  const days = eachDay(first, addDays(addMonths(first, 1), -1))
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
