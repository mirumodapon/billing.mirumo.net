import { describe, expect, it } from 'vitest'
import { makeTrip } from '../data/testing/fixtures'
import { tripNeedingBackup } from './backupReminder'

const tokyo = makeTrip({ id: 'tokyo', startDate: '2026-03-14', endDate: '2026-03-18' })
const seoul = makeTrip({ id: 'seoul', startDate: '2026-01-02', endDate: '2026-01-05' })
const future = makeTrip({ id: 'future', startDate: '2026-12-01', endDate: '2026-12-05' })

describe('tripNeedingBackup (spec 7.4, Plan 10 P7)', () => {
  it('asks for a trip that has ended when nothing was ever exported', () => {
    expect(tripNeedingBackup([future, seoul, tokyo], '2026-03-20', undefined)?.id).toBe('tokyo')
  })

  it('stays quiet while trips are still going or yet to come', () => {
    expect(tripNeedingBackup([future, makeTrip({ endDate: '2026-03-20' })], '2026-03-20', undefined)).toBeUndefined()
  })

  // 結束那天或之前匯出的不算：最後幾筆帳可能還沒進備份
  it('asks again when the last export was on or before the trip ended', () => {
    expect(tripNeedingBackup([tokyo], '2026-03-25', '2026-03-18T20:00:00.000Z')?.id).toBe('tokyo')
    expect(tripNeedingBackup([tokyo], '2026-03-25', '2026-03-19T08:00:00.000Z')).toBeUndefined()
  })

  it('ignores deleted trips', () => {
    expect(tripNeedingBackup([{ ...tokyo, deletedAt: '2026-03-19T00:00:00.000Z' }], '2026-03-25', undefined)).toBeUndefined()
  })
})
