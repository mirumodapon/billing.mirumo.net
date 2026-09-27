import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { validateSession } from '../session/coldStart'
import { useSessionSync } from '../session/useSessionSync'
import { useStores } from '../stores/StoresProvider'
import { BootSkeleton } from './BootSkeleton'

/**
 * 冷啟動第 2–3 步（規格 7.9）：載入設定與旅程清單，驗證 session 指向的旅程還在。
 *
 * 驗證完成之前只畫骨架，不畫子路由——先畫的話，session 指向已刪除旅程時
 * 會先閃過那一頁、或閃過旅程列表再跳頁（規格 12「冷啟動不閃過旅程列表」）。
 */
export function Boot({ children }: { children: ReactNode }) {
  const { settings, trips } = useStores()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const initialPath = useRef(pathname)
  // undefined：還在驗證；null：留在原地；字串：要轉去的路由
  const [target, setTarget] = useState<string | null | undefined>(undefined)

  /*
   * 「驗證完成」還不夠，要等位置真的到了目標才算好：react-router 7 把位置更新
   * 包在 startTransition 裡，比 setTarget 晚一拍。提早放行的話，子路由與 session
   * 同步都會先看到舊路由一次——session 會被寫回那個已刪除旅程的路徑。
   */
  const ready = target !== undefined && (target === null || pathname === target)
  useSessionSync(ready)

  /*
   * navigate 不能放進下面那個 effect 的相依：HashRouter 的 navigate 每換一次位置
   * 就是新的函式，effect 會因此重跑整個冷啟動——再驗證一次、再清一次 session、
   * 再開一次旅程，把使用者剛離開的旅程又載回來。用 ref 拿最新的那一個。
   */
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  useEffect(() => {
    // StrictMode 會跑兩次；被清掉的那一次不能再導航或標記完成
    let cancelled = false
    void (async () => {
      await settings.getState().load()
      await trips.getState().loadTrips()
      const redirect = await validateSession(initialPath.current, (id) => trips.getState().openTrip(id))
      if (cancelled) return
      if (redirect) navigateRef.current(redirect, { replace: true })
      setTarget(redirect)
    })()
    return () => {
      cancelled = true
    }
  }, [settings, trips])

  return ready ? children : <BootSkeleton />
}
