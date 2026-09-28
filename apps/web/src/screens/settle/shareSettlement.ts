export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

interface NavigatorLike {
  share?: (data: { title?: string; text?: string }) => Promise<void>
  clipboard?: { writeText(text: string): Promise<void> }
}

/**
 * 分享結算結果（規格 4.6）：走 Web Share API，不支援時退回複製到剪貼簿。
 *
 * 使用者在分享面板按取消（AbortError）不算失敗，也不該改去複製——那會在他
 * 明明取消了之後又跳出「已複製」。
 */
export async function shareSettlement(title: string, text: string, nav: NavigatorLike = globalThis.navigator): Promise<ShareOutcome> {
  if (typeof nav?.share === 'function') {
    try {
      await nav.share({ title, text })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // 其他錯誤（不允許、內容不支援）：往下退回複製
    }
  }
  try {
    await nav?.clipboard?.writeText(text)
    return nav?.clipboard ? 'copied' : 'failed'
  } catch {
    return 'failed'
  }
}
