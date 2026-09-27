/** 長邊上限（規格 7.3）。對收據足夠辨識，手機原圖 3–5MB 壓到約 120–200KB */
export const MAX_EDGE = 1600
const QUALITY = 0.8

export interface Decoded {
  width: number
  height: number
  source: CanvasImageSource
}

/**
 * 解碼與編碼抽成介面：jsdom 沒有 createImageBitmap 也沒有 canvas 編碼，
 * 壓縮的決策邏輯（尺寸、格式退路）才能在測試裡驗證。
 */
export interface ImageCodec {
  decode(file: Blob): Promise<Decoded>
  encode(source: CanvasImageSource, width: number, height: number, type: string, quality: number): Promise<Blob>
}

/** 等比例縮到長邊不超過 max，只縮不放大，結果取整數且至少 1px */
export function fitWithin(width: number, height: number, max: number = MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export interface Compressed {
  blob: Blob
  width: number
  height: number
}

/**
 * 拍照後立刻壓縮，原圖不落地（規格 7.3）。
 *
 * 先試 WebP；瀏覽器不支援 WebP 編碼時，canvas 依規範會默默改用 PNG 而不報錯
 * （部分 Safari 版本就是如此），一張收據就從一兩百 KB 變成好幾 MB，壓縮等於
 * 沒做。所以檢查實際拿到的格式，不是 WebP 就改用 JPEG——所有瀏覽器都支援，
 * 而且同樣是有損壓縮。
 */
export async function compressImage(file: Blob, codec: ImageCodec = browserCodec): Promise<Compressed> {
  const decoded = await codec.decode(file)
  const { width, height } = fitWithin(decoded.width, decoded.height)
  let blob = await codec.encode(decoded.source, width, height, 'image/webp', QUALITY)
  if (blob.type !== 'image/webp') blob = await codec.encode(decoded.source, width, height, 'image/jpeg', QUALITY)
  return { blob, width, height }
}

/**
 * 瀏覽器實作。jsdom 裡跑不了，所以不在單元測試範圍內——決策邏輯在
 * compressImage 裡、已有測試；這裡只是把瀏覽器 API 接上去。
 *
 * createImageBitmap 預設依 EXIF 轉正方向，直拍的收據不會變成橫的。
 */
export const browserCodec: ImageCodec = {
  async decode(file) {
    const bitmap = await createImageBitmap(file)
    return { width: bitmap.width, height: bitmap.height, source: bitmap }
  },
  async encode(source, width, height, type, quality) {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height)
      canvas.getContext('2d')!.drawImage(source, 0, 0, width, height)
      return canvas.convertToBlob({ type, quality })
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(source, 0, 0, width, height)
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), type, quality),
    )
  },
}
