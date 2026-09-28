interface RecordFlags {
  deletedAt?: string
  draft?: boolean
  /** 用預存卡付的，只扣餘額（task#115） */
  fromBalance?: boolean
  /** 儲值：替哪一張預存卡加值（task#115） */
  topUpFor?: string
}

/**
 * 一筆紀錄是不是「成立」的：沒被刪除，也不是草稿（task#96）。預存卡的餘額以此為準——
 * 用卡付的雖然不算進合計，但確實扣了餘額（task#115）。
 */
export function isLive(record: RecordFlags): boolean {
  return record.deletedAt === undefined && record.draft !== true
}

/**
 * 一筆紀錄算不算進任何合計：成立，而且不是從預存卡餘額扣的。
 *
 * 草稿是還沒填完、或使用者刻意先擱著的紀錄：看得到、改得了，但在標記為完成之前，
 * 不影響淨額、統計與預算（task#96）。預存卡的錢在儲值那一筆就算過了，之後用卡付的
 * 只是扣餘額，再算一次就重複（task#115）。所有計算都經過這一個判斷，不各寫一份。
 */
export function countsInTotals(record: RecordFlags): boolean {
  return isLive(record) && record.fromBalance !== true
}
