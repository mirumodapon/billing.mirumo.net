import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTrip } from '../data/testing/fixtures'
import { clearSession, readSession, writeSession } from '../data/session'
import { initialHash, tripIdOf, validateSession } from './coldStart'

beforeEach(() => clearSession())

describe('initialHash', () => {
  it('uses the saved route when the address names none', () => {
    expect(initialHash('', { route: '/trip/t1/setup' })).toBe('/trip/t1/setup')
    expect(initialHash('#/', { route: '/trip/t1/setup' })).toBe('/trip/t1/setup')
    expect(initialHash('#', { route: '/trip/t1/setup' })).toBe('/trip/t1/setup')
  })

  // 從書籤或分享連結打開某一頁：網址優先，不能被上次的 session 拉走
  it('keeps an address that already names a route', () => {
    expect(initialHash('#/settings', { route: '/trip/t1/setup' })).toBeNull()
  })

  it('does nothing without a session, or when the session is the trip list', () => {
    expect(initialHash('', null)).toBeNull()
    expect(initialHash('', { route: '/' })).toBeNull()
  })
})

describe('tripIdOf', () => {
  it('reads the id from trip routes only', () => {
    expect(tripIdOf('/trip/t1/expenses')).toBe('t1')
    expect(tripIdOf('/settings')).toBeUndefined()
    expect(tripIdOf('/trip/t1')).toBeUndefined()
  })
})

describe('validateSession', () => {
  it('keeps a route whose trip still exists', async () => {
    expect(await validateSession('/trip/t1/setup', async () => makeTrip({ id: 't1' }))).toBeNull()
  })

  // 規格 7.9 第 3 步：靜默退回旅程列表並清掉 session，不顯示錯誤
  it('falls back to the trip list and clears the session when the trip is gone', async () => {
    writeSession({ route: '/trip/t1/setup', tripId: 't1' })
    expect(await validateSession('/trip/t1/setup', async () => undefined)).toBe('/')
    expect(readSession()).toBeNull()
  })

  it('leaves other routes alone without touching the data', async () => {
    const open = vi.fn()
    expect(await validateSession('/settings', open)).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })
})
