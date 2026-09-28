/**
 * 一筆紀錄算不算進任何合計：沒被刪除，也不是草稿（task#96）。
 *
 * 草稿是還沒填完、或使用者刻意先擱著的紀錄：看得到、改得了，但在標記為完成之前，
 * 不影響淨額、統計與預算。所有計算都經過這一個判斷，不各寫一份。
 */
export function countsInTotals(record: { deletedAt?: string; draft?: boolean }): boolean {
  return record.deletedAt === undefined && record.draft !== true
}
