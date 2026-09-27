import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  daysBetween,
  eachDay,
  isValidIso,
  monthGrid,
  parseIso,
  startOfMonth,
  toIso,
} from './isoDate'

describe('isoDate', () => {
  // 測試時區固定在 UTC−7/−8，用本地時間解析的話這裡會變成前一天
  it('parses a plain date as UTC midnight', () => {
    expect(parseIso('2026-03-15').toISOString()).toBe('2026-03-15T00:00:00.000Z')
    expect(toIso(parseIso('2026-03-15'))).toBe('2026-03-15')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('knows about leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-03-14', '2026-03-18')).toBe(4)
    expect(daysBetween('2026-03-18', '2026-03-14')).toBe(-4)
  })

  it('lists every day of a range, both ends included', () => {
    expect(eachDay('2026-03-14', '2026-03-16')).toEqual(['2026-03-14', '2026-03-15', '2026-03-16'])
    expect(eachDay('2026-03-16', '2026-03-14')).toEqual([])
  })

  // 從 1/31 加一個月不能溢位成 3/3：月份運算一律先回到當月一號
  it('moves between months without overflowing short ones', () => {
    expect(startOfMonth('2026-03-15')).toBe('2026-03-01')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
  })

  // 2026-03-01 是星期日
  it('lays a month out in weeks starting on Sunday', () => {
    const weeks = monthGrid('2026-03-15', 0)
    expect(weeks[0]![0]).toBe('2026-03-01')
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks.flat().filter(Boolean)).toHaveLength(31)
  })

  it('lays a month out in weeks starting on Monday', () => {
    const weeks = monthGrid('2026-03-15', 1)
    expect(weeks[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(weeks[0]![6]).toBe('2026-03-01')
  })

  it('validates real calendar dates only', () => {
    expect(isValidIso('2026-03-01')).toBe(true)
    expect(isValidIso('2026-02-30')).toBe(false)
    expect(isValidIso('2026-3-1')).toBe(false)
    expect(isValidIso('')).toBe(false)
  })
})
