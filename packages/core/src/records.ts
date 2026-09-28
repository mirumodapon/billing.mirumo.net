interface RecordFlags {
  deletedAt?: string
  draft?: boolean
  /** 用預存卡付的，會扣卡片餘額（task#115） */
  fromBalance?: boolean
  /** 儲值：替哪一張預存卡加值（task#115） */
  topUpFor?: string
}

/**
 * 一筆紀錄是不是「成立」的：沒被刪除，也不是草稿（task#96）。預存卡的餘額以此為準——
 * 儲值雖然不算進合計，但確實加了餘額（task#115、task#137）。
 */
export function isLive(record: RecordFlags): boolean {
  return record.deletedAt === undefined && record.draft !== true
}

/**
 * 一筆紀錄算不算進任何合計：成立，而且不是儲值。
 *
 * 草稿是還沒填完、或使用者刻意先擱著的紀錄：看得到、改得了，但在標記為完成之前，
 * 不影響淨額、統計與預算（task#96）。儲值只是把錢放進預存卡，還沒花掉：之後用卡付的
 * 每一筆才是真的花費，照付款人與分攤計算（task#137，取代 task#115 的「儲值才算」）。
 * 所有計算都經過這一個判斷，不各寫一份。
 */
export function countsInTotals(record: RecordFlags): boolean {
  return isLive(record) && record.topUpFor === undefined
}
