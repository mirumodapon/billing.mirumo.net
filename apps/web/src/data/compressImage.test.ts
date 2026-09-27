import { describe, expect, it } from 'vitest'
import { compressImage, fitWithin, type ImageCodec } from './compressImage'

/** 假的編解碼器：記下每次編碼要求的格式，並可模擬「不支援 WebP 就回 PNG」 */
function fakeCodec(width: number, height: number, supportsWebp: boolean) {
  const requested: string[] = []
  const codec: ImageCodec = {
    decode: async () => ({ width, height, source: {} as CanvasImageSource }),
    encode: async (_source, w, h, type) => {
      requested.push(`${type} ${w}x${h}`)
      // 依 canvas 規範：不支援的格式默默改成 PNG，不報錯
      const actual = type === 'image/webp' && !supportsWebp ? 'image/png' : type
      return new Blob([new Uint8Array(10)], { type: actual })
    },
  }
  return { codec, requested }
}

describe('fitWithin', () => {
  it('shrinks the long edge to 1600 and keeps the aspect ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('never enlarges a small photo', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('returns whole pixels', () => {
    expect(fitWithin(4001, 3001)).toEqual({ width: 1600, height: 1200 })
  })

  // 極端長寬比（長條收據）不能把短邊縮成 0px
  it('keeps at least one pixel on the short edge', () => {
    expect(fitWithin(100_000, 10).height).toBe(1)
  })
})

describe('compressImage', () => {
  it('encodes as WebP at the reduced size when the browser can', async () => {
    const { codec, requested } = fakeCodec(4000, 3000, true)
    const result = await compressImage(new Blob(['raw']), codec)
    expect(requested).toEqual(['image/webp 1600x1200'])
    expect(result).toMatchObject({ width: 1600, height: 1200 })
    expect(result.blob.type).toBe('image/webp')
  })

  /*
   * 不支援 WebP 的瀏覽器會默默回 PNG：沒有這道退路，收據照片會從一兩百 KB
   * 變成好幾 MB，壓縮等於沒做，而且完全不會報錯。
   */
  it('falls back to JPEG when the browser quietly returns PNG instead of WebP', async () => {
    const { codec, requested } = fakeCodec(4000, 3000, false)
    const result = await compressImage(new Blob(['raw']), codec)
    expect(requested).toEqual(['image/webp 1600x1200', 'image/jpeg 1600x1200'])
    expect(result.blob.type).toBe('image/jpeg')
  })

  // AttachmentMeta 需要寬高，回傳的必須是壓縮後的尺寸而不是原圖的
  it('reports the size of the compressed image, not the original', async () => {
    const { codec } = fakeCodec(3000, 4000, true)
    expect(await compressImage(new Blob(['raw']), codec)).toMatchObject({ width: 1200, height: 1600 })
  })
})
