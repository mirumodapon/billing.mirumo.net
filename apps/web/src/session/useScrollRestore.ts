import { useEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router'
import { readSession, writeSession } from '../data/session'

/** 捲動停下多久才算「停止」。太短會在慣性捲動途中寫一堆次 */
const SETTLE_MS = 150

/**
 * 列表捲動位置的保存與還原（規格 7.9）。
 *
 * - 捲動停止 → 寫進 session.scrollTop[路由]
 * - ready 第一次為 true（資料已載入）→ 下一個 frame 還原，每個路由只還原一次；
 *   之後資料重載不再動，使用者捲到別處不會被拉回去
 */
export function useScrollRestore(ref: RefObject<HTMLElement | null>, ready: boolean): void {
  const { pathname } = useLocation()
  const restoredFor = useRef<string | null>(null)

  useEffect(() => {
    if (!ready || restoredFor.current === pathname) return
    const saved = readSession()?.scrollTop?.[pathname]
    // 標記寫在 frame 裡而不是這裡：StrictMode 會先執行一次 effect 再立刻清掉，
    // 在這裡標記的話，第二次執行會以為已經還原過，結果永遠不還原
    const id = requestAnimationFrame(() => {
      restoredFor.current = pathname
      if (saved !== undefined && ref.current) ref.current.scrollTop = saved
    })
    return () => cancelAnimationFrame(id)
  }, [ready, pathname, ref])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const session = readSession() ?? { route: pathname }
        writeSession({ ...session, scrollTop: { ...session.scrollTop, [pathname]: el.scrollTop } })
      }, SETTLE_MS)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      el.removeEventListener('scroll', onScroll)
    }
  }, [pathname, ref])
}
