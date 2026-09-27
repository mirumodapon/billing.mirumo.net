import { describe, expect, it } from 'vitest'
import { migrate, migrateSnapshot, type Migration } from './migrations'
import { SNAPSHOT_VERSION } from './types'

/*
 * 正式遷移表目前是空的（第一版），所以用假的三步遷移來驗證機制本身：
 * 等真的需要 v1 → v2 的那天，鏈條必須已經是對的。
 */
const fake: Record<number, Migration> = {
  1: (raw) => ({ ...raw, renamed: raw.oldName, oldName: undefined }),
  2: (raw) => ({ ...raw, tags: [] }),
}

describe('migrate', () => {
  it('runs every step from the backup’s version up to the target', () => {
    const result = migrate({ schemaVersion: 1, oldName: 'x' }, fake, 3)
    expect(result).toEqual({ ok: true, value: { schemaVersion: 3, renamed: 'x', oldName: undefined, tags: [] } })
  })

  it('starts from where the backup is, not from the beginning', () => {
    const result = migrate({ schemaVersion: 2, renamed: 'y' }, fake, 3)
    expect(result).toEqual({ ok: true, value: { schemaVersion: 3, renamed: 'y', tags: [] } })
  })

  it('leaves a current backup alone', () => {
    expect(migrate({ schemaVersion: 3, a: 1 }, fake, 3)).toEqual({ ok: true, value: { schemaVersion: 3, a: 1 } })
  })

  // 缺一步就拒絕，而不是跳過——跳過的那一步正是資料悄悄變形的地方
  it('refuses when a step is missing', () => {
    expect(migrate({ schemaVersion: 1 }, { 1: fake[1]! }, 3)).toEqual({ ok: false, problem: 'no migration from v2 to v3' })
  })

  it('refuses a backup from a newer version', () => {
    expect(migrate({ schemaVersion: 4 }, fake, 3)).toEqual({ ok: false, problem: 'backup was made by a newer version (v4)' })
  })

  it('refuses a backup with no usable version', () => {
    expect(migrate({}, fake, 3)).toMatchObject({ ok: false })
    expect(migrate({ schemaVersion: 1.5 }, fake, 3)).toMatchObject({ ok: false })
    expect(migrate({ schemaVersion: 0 }, fake, 3)).toMatchObject({ ok: false })
    expect(migrate('text', fake, 3)).toEqual({ ok: false, problem: 'not a backup file' })
  })

  // 遷移函式不該改到呼叫端手上的物件
  it('does not mutate its input', () => {
    const input = { schemaVersion: 1, oldName: 'x' }
    migrate(input, fake, 3)
    expect(input).toEqual({ schemaVersion: 1, oldName: 'x' })
  })
})

describe('migrateSnapshot', () => {
  it('accepts a backup at the current version', () => {
    expect(migrateSnapshot({ schemaVersion: SNAPSHOT_VERSION })).toMatchObject({ ok: true })
  })
})
