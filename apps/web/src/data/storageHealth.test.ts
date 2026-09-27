import { describe, expect, it, vi } from 'vitest'
import { requestPersistence, storageStatus } from './storageHealth'

const manager = (overrides: Partial<Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>>) =>
  ({ persist: vi.fn(), persisted: vi.fn(), estimate: vi.fn(), ...overrides }) as Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>

describe('requestPersistence', () => {
  it('asks the browser to keep the data and reports its answer', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    expect(await requestPersistence(manager({ persisted: vi.fn().mockResolvedValue(false), persist }))).toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  // 已經是持久儲存就不必再問，有些瀏覽器每問一次都跳提示
  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn()
    expect(await requestPersistence(manager({ persisted: vi.fn().mockResolvedValue(true), persist }))).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('reports false instead of throwing when unsupported or failing', async () => {
    expect(await requestPersistence(undefined)).toBe(false)
    expect(await requestPersistence(manager({ persisted: vi.fn().mockRejectedValue(new Error('x')) }))).toBe(false)
  })
})

describe('storageStatus', () => {
  it('reports usage against the quota', async () => {
    const status = await storageStatus(manager({ estimate: vi.fn().mockResolvedValue({ usage: 30, quota: 100 }) }))
    expect(status).toEqual({ usage: 30, quota: 100, ratio: 0.3, nearlyFull: false })
  })

  // 規格 7.4：達 80% 警示。剛好 80% 要算——沒有這條的話 >= 換成 > 分不出來
  it('flags storage as nearly full from exactly 80%', async () => {
    expect((await storageStatus(manager({ estimate: vi.fn().mockResolvedValue({ usage: 80, quota: 100 }) })))?.nearlyFull).toBe(true)
    expect((await storageStatus(manager({ estimate: vi.fn().mockResolvedValue({ usage: 79, quota: 100 }) })))?.nearlyFull).toBe(false)
  })

  it('returns null when the browser gives no estimate', async () => {
    expect(await storageStatus(undefined)).toBeNull()
    expect(await storageStatus(manager({ estimate: vi.fn().mockResolvedValue({}) }))).toBeNull()
  })
})
