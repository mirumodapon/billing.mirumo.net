import { beforeEach, describe, expect, it } from 'vitest'
import { ERROR_LOG_KEY, ERROR_LOG_LIMIT, ErrorLog, installGlobalErrorLogging } from './errorLog'
import { tickingClock } from './testing/fixtures'

beforeEach(() => localStorage.clear())

const throwing = new Proxy({} as Storage, {
  get() {
    throw new DOMException('denied', 'SecurityError')
  },
})

describe('ErrorLog', () => {
  it('records an error with its name, message and stack', () => {
    const log = new ErrorLog(localStorage, tickingClock())
    log.record(new TypeError('boom'))
    const [entry] = log.list()
    expect(entry).toMatchObject({ at: '2026-03-15T00:00:00.000Z', message: 'TypeError: boom' })
    expect(entry!.stack).toContain('boom')
  })

  it('records things that are not Error objects', () => {
    const log = new ErrorLog(localStorage)
    log.record('plain string')
    expect(log.list()[0]!.message).toBe('plain string')
  })

  // 環狀緩衝區：只留最新的 50 筆，舊的從前面丟
  it('keeps only the newest fifty entries', () => {
    const log = new ErrorLog(localStorage)
    for (let i = 0; i < ERROR_LOG_LIMIT + 5; i += 1) log.record(`e${i}`)
    const entries = log.list()
    expect(entries).toHaveLength(ERROR_LOG_LIMIT)
    expect(entries[0]!.message).toBe('e5')
    expect(entries.at(-1)!.message).toBe(`e${ERROR_LOG_LIMIT + 4}`)
  })

  it('clears the log', () => {
    const log = new ErrorLog(localStorage)
    log.record('x')
    log.clear()
    expect(log.list()).toEqual([])
  })

  it('treats a corrupted log as empty rather than failing', () => {
    localStorage.setItem(ERROR_LOG_KEY, '{broken')
    expect(new ErrorLog(localStorage).list()).toEqual([])
  })

  // 記錄錯誤的程式碼出錯，會把原本要記錄的錯誤蓋掉
  it('never throws, even when storage is unavailable', () => {
    const log = new ErrorLog(throwing)
    expect(() => log.record(new Error('x'))).not.toThrow()
    expect(log.list()).toEqual([])
    expect(() => log.clear()).not.toThrow()
  })
})

describe('installGlobalErrorLogging', () => {
  it('records uncaught errors and unhandled rejections until uninstalled', () => {
    const log = new ErrorLog(localStorage)
    const uninstall = installGlobalErrorLogging(log)
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('uncaught'), message: 'uncaught' }))
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(rejection, 'reason', { value: new Error('rejected') })
    window.dispatchEvent(rejection)
    expect(log.list().map((e) => e.message)).toEqual(['Error: uncaught', 'Error: rejected'])

    uninstall()
    // 沒有任何監聽者時，jsdom 會把這個事件當成真的未捕捉錯誤回報給 vitest，
    // 整個測試執行就被判失敗。掛一個會 preventDefault 的替身把它吃掉。
    const swallow = (event: Event) => event.preventDefault()
    window.addEventListener('error', swallow)
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('after'), cancelable: true }))
    window.removeEventListener('error', swallow)
    expect(log.list()).toHaveLength(2)
  })
})
