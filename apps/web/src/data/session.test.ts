import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, readSession, SESSION_KEY, writeSession } from './session'

beforeEach(() => localStorage.clear())

/** 一個每次存取都拋錯的 Storage，模擬無痕模式或被封鎖的網站資料 */
const throwing = new Proxy({} as Storage, {
  get() {
    throw new DOMException('denied', 'SecurityError')
  },
})

describe('session', () => {
  it('round-trips the operating state', () => {
    const state = { route: '/trip/t1/stats', tripId: 't1', statsScope: 'group' as const, scrollTop: { '/trip/t1/expenses': 420 }, filters: { tripId: 't1', categoryIds: ['cat.food'], payers: ['a'], paymentMethodIds: [], draftsOnly: true } }
    writeSession(state)
    expect(readSession()).toEqual(state)
  })

  it('returns null when nothing was saved', () => {
    expect(readSession()).toBeNull()
  })

  it('clears the saved state', () => {
    writeSession({ route: '/' })
    clearSession()
    expect(readSession()).toBeNull()
  })

  /*
   * 壞掉的 session 絕不能讓 app 開不起來：讀到任何不對勁的東西都回 null，
   * 讓 app 走預設路由。這些情況都真的會發生——舊版本寫的格式、手動清到一半、
   * 擴充套件亂改 localStorage。
   */
  it('ignores malformed JSON', () => {
    localStorage.setItem(SESSION_KEY, '{not json')
    expect(readSession()).toBeNull()
  })

  it('ignores values of the wrong shape', () => {
    for (const bad of [
      'null',
      '"just a string"',
      '{"tripId":"t1"}',
      '{"route":"trip/t1"}',
      '{"route":"/","statsScope":"everyone"}',
      '{"route":"/","filters":{"tripId":"t1","categoryIds":"x","payers":[],"paymentMethodIds":[],"draftsOnly":false}}',
      // 舊規格的形狀（從沒寫進去過），以及少了旅程 id 的
      '{"route":"/","filters":{"categoryIds":[],"memberIds":[]}}',
      '{"route":"/","filters":{"categoryIds":[],"payers":[],"paymentMethodIds":[],"draftsOnly":false}}',
      '{"route":"/","scrollTop":{"/":"far"}}',
      '{"route":"/","collapsedStats":"daily"}',
      '{"route":"/","statsMember":3}',
    ]) {
      localStorage.setItem(SESSION_KEY, bad)
      expect(readSession(), bad).toBeNull()
    }
  })

  // 無痕模式下 localStorage 一碰就拋錯；session 只是便利，不能讓整個 app 掛掉
  it('never throws when storage is unavailable', () => {
    expect(readSession(throwing)).toBeNull()
    expect(() => writeSession({ route: '/' }, throwing)).not.toThrow()
    expect(() => clearSession(throwing)).not.toThrow()
  })
})
