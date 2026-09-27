import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliverFile, type DeliveryEnv } from './deliverFile'

const file = new File(['{}'], 'travel-split-2026-09-24.json', { type: 'application/json' })

function env(nav: DeliveryEnv['navigator']) {
  const clicks: string[] = []
  const revoked: string[] = []
  const e: DeliveryEnv = {
    navigator: nav,
    document,
    createObjectURL: () => 'blob:fake',
    revokeObjectURL: (url) => revoked.push(url),
  }
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push(`${this.download}|${this.href}`)
  })
  return { e, clicks, revoked }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('deliverFile', () => {
  it('uses the share sheet when the browser can share files', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const { e, clicks } = env({ share, canShare: () => true })
    expect(await deliverFile(file, e)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ files: [file], title: file.name })
    expect(clicks).toEqual([])
  })

  it('downloads when the browser cannot share files', async () => {
    const { e, clicks } = env({ share: vi.fn(), canShare: () => false })
    expect(await deliverFile(file, e)).toBe('downloaded')
    expect(clicks).toEqual(['travel-split-2026-09-24.json|blob:fake'])
  })

  it('downloads when there is no share support at all', async () => {
    const { e, clicks } = env(undefined)
    expect(await deliverFile(file, e)).toBe('downloaded')
    expect(clicks).toHaveLength(1)
  })

  // 使用者按取消是選擇，不是錯誤——不能因此改用下載把檔案硬塞給他
  it('respects a cancelled share instead of forcing a download', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    const { e, clicks } = env({ share, canShare: () => true })
    expect(await deliverFile(file, e)).toBe('cancelled')
    expect(clicks).toEqual([])
  })

  it('falls back to downloading when sharing fails for another reason', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    const { e, clicks } = env({ share, canShare: () => true })
    expect(await deliverFile(file, e)).toBe('downloaded')
    expect(clicks).toHaveLength(1)
  })

  // 不撤銷的話每次匯出都洩漏一份檔案大小的記憶體；立刻撤銷則部分瀏覽器來不及下載
  it('releases the download URL shortly afterwards, not immediately', async () => {
    vi.useFakeTimers()
    const { e, revoked } = env(undefined)
    await deliverFile(file, e)
    expect(revoked).toEqual([])
    vi.advanceTimersByTime(1000)
    expect(revoked).toEqual(['blob:fake'])
  })
})
