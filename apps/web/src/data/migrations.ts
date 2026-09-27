import { SNAPSHOT_VERSION } from './types'

type Raw = Record<string, unknown>

/** 從版本 n 升到 n+1。純函式，各自有測試（規格 7.8） */
export type Migration = (raw: Raw) => Raw

export type MigrationResult = { ok: true; value: Raw } | { ok: false; problem: string }

/**
 * 依序套用遷移，把任何舊版本的備份升到 target。
 *
 * 遷移表以「來源版本」為 key：migrations[1] 把 v1 變成 v2。缺了中間任何一步
 * 就拒絕，而不是跳過——跳過的那一步正是資料會悄悄變形的地方。
 */
export function migrate(input: unknown, migrations: Readonly<Record<number, Migration>>, target: number): MigrationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, problem: 'not a backup file' }
  }
  let raw = input as Raw
  const from = raw.schemaVersion
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) {
    return { ok: false, problem: 'backup has no valid version' }
  }
  // 新版本做的備份：舊版 app 不知道多出來的欄位代表什麼，不能假裝看得懂
  if (from > target) return { ok: false, problem: `backup was made by a newer version (v${from})` }

  for (let version = from; version < target; version += 1) {
    const step = migrations[version]
    if (!step) return { ok: false, problem: `no migration from v${version} to v${version + 1}` }
    raw = { ...step(raw), schemaVersion: version + 1 }
  }
  return { ok: true, value: raw }
}

/**
 * 正式的遷移表。第一版還沒有任何遷移；改動 Snapshot 形狀時，
 * 把 SNAPSHOT_VERSION 加一，並在這裡補上從舊版本到新版本的那一步。
 */
export const SNAPSHOT_MIGRATIONS: Readonly<Record<number, Migration>> = {}

export function migrateSnapshot(input: unknown): MigrationResult {
  return migrate(input, SNAPSHOT_MIGRATIONS, SNAPSHOT_VERSION)
}
