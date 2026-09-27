import { useEffect, useMemo, useRef, useState } from 'react'
import { createDraftWriter, onPageHidden } from '../../data/drafts'
import { isExpenseDraft, type ExpenseDraft } from '../../domain/expenseDraft'
import { useStores } from '../../stores/StoresProvider'

type State = { status: 'loading' } | { status: 'ready'; draft: ExpenseDraft; restored: boolean }

/**
 * 支出表單的草稿（規格 7.9）：以路由為 key，每個路由一份。
 *
 * - 進表單先讀草稿；有就還原並標記 restored，讓畫面顯示提示
 * - 每次變更 debounce 300ms 寫入；切到背景（visibilitychange → hidden）與卸載時立刻寫
 * - 存檔成功或使用者捨棄時，取消待寫入的內容並刪掉草稿
 */
export function useExpenseDraft(route: string, initial: ExpenseDraft) {
  const { drafts } = useStores()
  const [state, setState] = useState<State>({ status: 'loading' })
  const current = useRef<ExpenseDraft>(initial)
  const writer = useMemo(() => createDraftWriter(drafts, route), [drafts, route])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let saved: unknown
      try {
        saved = (await drafts.load(route))?.value
      } catch {
        saved = undefined
      }
      if (cancelled) return
      if (isExpenseDraft(saved)) {
        current.current = saved
        setState({ status: 'ready', draft: saved, restored: true })
        return
      }
      // 讀到壞掉的草稿（舊版的形狀、寫到一半）：丟掉，當作沒有
      if (saved !== undefined) void drafts.discard(route).catch(() => {})
      setState({ status: 'ready', draft: initial, restored: false })
    })()
    return () => {
      cancelled = true
    }
    // initial 只在第一次決定要不要用它；之後換了也不重新載入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, route])

  // iOS 上唯一可靠的「即將離開」訊號；卸載時也寫，換頁不等 300ms
  useEffect(() => onPageHidden(() => void writer.flush()), [writer])
  useEffect(() => () => void writer.flush(), [writer])

  const draft = state.status === 'ready' ? state.draft : initial

  return {
    ready: state.status === 'ready',
    draft,
    restored: state.status === 'ready' && state.restored,
    /** 與進表單時的初始值不同：按 ✕ 時要詢問要不要保留 */
    dirty: JSON.stringify(draft) !== JSON.stringify(initial),

    setDraft(update: (d: ExpenseDraft) => ExpenseDraft) {
      const next = update(current.current)
      current.current = next
      setState((s) => (s.status === 'ready' ? { ...s, draft: next } : s))
      writer.update(next)
    },

    /** 捨棄還原的草稿，回到初始值 */
    discardRestored() {
      writer.cancel()
      current.current = initial
      setState({ status: 'ready', draft: initial, restored: false })
      void drafts.discard(route).catch(() => {})
    },

    /**
     * 存檔成功或使用者選擇捨棄：cancel 而不只是停計時器。Plan 5 找到的缺口：
     * 只停計時器不清待寫內容，之後切到背景時 flush 會把捨棄的草稿寫回去。
     */
    async abandon() {
      writer.cancel()
      await drafts.discard(route).catch(() => {})
    },

    /** 使用者選擇保留草稿後離開：把還沒寫的內容立刻寫進去 */
    keep: () => writer.flush(),
  }
}
