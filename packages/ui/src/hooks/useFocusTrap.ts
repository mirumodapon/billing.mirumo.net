import { useEffect, useRef } from 'react'

/**
 * 可聚焦元素的選擇器。
 *
 * `[tabindex]:not([tabindex="-1"])` 這一段是必要的：自製元件常用 tabindex 讓
 * 非互動標籤可聚焦，漏掉它們焦點就會跳過去。反之 -1 是「程式可聚焦但不進
 * Tab 順序」，不能算在循環裡。
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    // inert 的子樹依規範不可聚焦，但選擇器照樣選得到。把它們留在循環裡的話，
    // first.focus() 會靜默失敗、焦點原地不動，Tab 看起來就像壞掉。
    // Accordion 收折時正是用 inert，而它會被放進 Sheet 裡。
    if (el.closest('[inert]')) return false
    // 隱藏的元素仍會被選擇器選中，但聚焦上去等於焦點消失
    return el.offsetParent !== null || el === document.activeElement
  })
}

/**
 * 把鍵盤焦點關在 ref 指到的容器裡，並在關閉時還給原本的元素。
 *
 * 回傳型別是泛型的：React 的 ref 對元素型別是不變的，所以寫死
 * `RefObject<HTMLElement>` 掛不到 `<div>` 上。若在這裡用 cast 蓋掉，
 * Sheet、Dialog、SheetPicker 三個呼叫端就得各自再 cast 一次。
 *
 * @param active 是否啟用。false 時完全不掛任何 listener
 * @param onEscape 按下 Escape 時呼叫；不給就不處理 Escape
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
  onEscape?: () => void,
) {
  const ref = useRef<T | null>(null)
  // 用 ref 存回，避免 onEscape 每次 render 換身分就重掛 listener。
  // 同步必須在 effect 裡做而不是 render 期間——render 要是純的，而且
  // React 在並行模式下可能丟棄一次 render 的結果，那時 ref 已經被改掉了。
  // 放在 keydown 那個 effect 之前，掛上 listener 時值就已經是新的。
  const escapeRef = useRef(onEscape)
  useEffect(() => {
    escapeRef.current = onEscape
  })

  useEffect(() => {
    if (!active) return
    const root = ref.current
    if (!root) return

    // 先記下是誰把焦點交出來的，收尾時要還回去
    const restoreTo = document.activeElement as HTMLElement | null

    focusableWithin(root)[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        escapeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusableWithin(root!)
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      // 只在兩端接手，中間交給瀏覽器自己走，行為才跟原生一致
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      restoreTo?.focus()
    }
  }, [active])

  return ref
}
