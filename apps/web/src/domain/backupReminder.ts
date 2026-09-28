import type { Trip } from '@billing/core'

/**
 * 旅程結束後提醒匯出備份（規格 7.4 最後一道保險、Plan 10 P7）。
 * 找出已經結束、而且上次匯出早於它結束那天的旅程；有好幾趟時提最近結束的那一趟。
 */
export function tripNeedingBackup(trips: readonly Trip[], today: string, lastExport: string | undefined): Trip | undefined {
  const ended = trips.filter((t) => !t.deletedAt && t.endDate < today)
  // 匯出時間是 ISO 時間戳，結束日是日期：比「匯出那天」有沒有晚於結束日
  const exportedDay = lastExport?.slice(0, 10)
  const unsaved = ended.filter((t) => exportedDay === undefined || exportedDay <= t.endDate)
  return unsaved.sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
}
