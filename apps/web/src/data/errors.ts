/** IndexedDB 操作失敗。附上操作語意，錯誤記錄與畫面才說得出是哪件事壞了 */
export class StorageError extends Error {
  constructor(
    readonly op: 'read' | 'write' | 'delete' | 'migrate',
    readonly entity: string,
    cause?: unknown,
  ) {
    super(`storage ${op} failed: ${entity}`, { cause })
    this.name = 'StorageError'
  }
}

/**
 * 想從旅程移除仍被支出或轉帳引用的成員（task#61）。
 *
 * core 假設輸入自洽：成員被移除而紀錄仍引用他的 id 時，netBalances 會讓錢消失
 * （實測三人旅程裡付款人被移除，Σ net 變成 −300）。決定不改 core，改在資料層擋。
 */
export class MemberInUseError extends Error {
  constructor(
    readonly tripId: string,
    readonly memberIds: readonly string[],
  ) {
    super(`members still referenced by records: ${memberIds.join(', ')}`)
    this.name = 'MemberInUseError'
  }
}

/**
 * 要存的紀錄引用了不存在的東西：不存在的旅程，或不是該旅程成員的人。
 * 與 MemberInUseError 是同一個不變量的兩個方向——一個擋移除，一個擋寫入。
 */
export class IntegrityError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`integrity check failed: ${problems.join('; ')}`)
    this.name = 'IntegrityError'
  }
}

/** 匯入的備份不合格。problems 逐條列出，UI 可以直接顯示 */
export class SnapshotError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`invalid snapshot: ${problems.length} problem(s)`)
    this.name = 'SnapshotError'
  }
}
