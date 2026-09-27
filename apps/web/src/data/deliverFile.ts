export type DeliveryResult = 'shared' | 'downloaded' | 'cancelled'

export interface DeliveryEnv {
  navigator: Pick<Navigator, 'share' | 'canShare'> | undefined
  document: Document
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
}

const browserEnv = (): DeliveryEnv => ({
  navigator: typeof navigator === 'undefined' ? undefined : navigator,
  document,
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
})

/**
 * 把匯出檔交給使用者（規格 13.2.1）。
 *
 * iOS 的 standalone PWA 對 <a download> 支援不穩定，所以優先走分享面板，讓使用者
 * 存到「檔案」或直接傳出去；不支援分享檔案時才退回下載。
 *
 * 使用者在分享面板按取消會拋 AbortError——那是正常的選擇，不是錯誤，也不能
 * 因此改走下載把檔案硬塞給他。
 */
export async function deliverFile(file: File, env: DeliveryEnv = browserEnv()): Promise<DeliveryResult> {
  const nav = env.navigator
  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // 其他錯誤（例如權限）退回下載，使用者至少拿得到檔案
    }
  }
  const url = env.createObjectURL(file)
  const link = env.document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  env.document.body.append(link)
  link.click()
  link.remove()
  // 立刻撤銷的話，部分瀏覽器來不及開始下載
  setTimeout(() => env.revokeObjectURL(url), 1000)
  return 'downloaded'
}
