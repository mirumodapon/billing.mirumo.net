/** 當地日期的 'YYYY-MM-DD'。不用 toISOString：那是 UTC，台灣早上八點前會變成昨天 */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
