import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { FX_API, fetchRate } from './fetchRate'

const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('fetchRate', () => {
  it('reads the rate for the target currency', async () => {
    const fake = respond({ rates: { TWD: 0.2123 } })
    expect(await fetchRate('JPY', 'TWD', fake)).toEqual({ ok: true, rate: 0.2123 })
    expect(fake).toHaveBeenCalledWith(`${FX_API}/latest?from=JPY&to=TWD`)
  })

  it('reports offline when the request cannot be made at all', async () => {
    const fake = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await fetchRate('JPY', 'TWD', fake)).toEqual({ ok: false, reason: 'offline' })
  })

  it('reports a currency the service does not know', async () => {
    expect(await fetchRate('VND', 'TWD', respond({ message: 'not found' }, 404))).toEqual({ ok: false, reason: 'unsupported' })
    expect(await fetchRate('VND', 'TWD', respond({ message: 'bad' }, 422))).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('reports any other server error as a failure', async () => {
    expect(await fetchRate('JPY', 'TWD', respond({}, 500))).toEqual({ ok: false, reason: 'failed' })
  })

  // 填進欄位的值要能直接用：0、NaN、字串都不算匯率
  it.each([{}, { rates: {} }, { rates: { TWD: 0 } }, { rates: { TWD: '0.21' } }, { rates: { TWD: null } }])(
    'rejects a response without a usable rate: %j',
    async (body) => {
      expect(await fetchRate('JPY', 'TWD', respond(body))).toEqual({ ok: false, reason: 'failed' })
    },
  )

  it('rejects a body that is not JSON', async () => {
    const fake = vi.fn(async () => new Response('<html>', { status: 200 }))
    expect(await fetchRate('JPY', 'TWD', fake)).toEqual({ ok: false, reason: 'failed' })
  })

  it('answers 1 for the same currency without asking', async () => {
    const fake = respond({})
    expect(await fetchRate('TWD', 'TWD', fake)).toEqual({ ok: true, rate: 1 })
    expect(fake).not.toHaveBeenCalled()
  })

  /*
   * 規格 7.6：Service Worker 以網址前綴快取匯率回應，離線時還拿得到最後一次的值。
   * 前綴與這裡的 API 位址不一致的話，快取靜靜失效。設定檔不進 jsdom，讀原始碼比對。
   */
  it('is cached by the service worker under the same address', () => {
    const config = readFileSync(join(import.meta.dirname, '../../vite.config.ts'), 'utf8')
    const literal = /urlPattern:\s*\/(.+)\/,/.exec(config)?.[1]
    expect(literal).toBeDefined()
    expect(new RegExp(literal!).test(`${FX_API}/latest?from=JPY&to=TWD`)).toBe(true)
  })
})
