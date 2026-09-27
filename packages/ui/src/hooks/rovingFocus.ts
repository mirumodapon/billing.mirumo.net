import { useRef, type KeyboardEvent } from 'react'

/**
 * 依按鍵算出下一個索引；不是這個模型處理的鍵回 null。
 *
 * 一維：左右上下都是 ±1 並繞回（單選群組的常規）。
 * 格狀（給了 columns）：左右 ±1 繞回，上下 ±columns 但到頂到底停住。
 */
export function nextIndex(
  current: number,
  key: string,
  length: number,
  columns?: number,
): number | null {
  if (length === 0) return null
  const from = current < 0 ? 0 : current
  const wrap = (i: number) => ((i % length) + length) % length

  if (key === 'Home') return 0
  if (key === 'End') return length - 1

  if (columns && (key === 'ArrowUp' || key === 'ArrowDown')) {
    const target = from + (key === 'ArrowDown' ? columns : -columns)
    // 超出範圍就停在原地：上下繞回在視覺上像瞬移
    return target < 0 || target >= length ? from : target
  }

  if (key === 'ArrowRight' || key === 'ArrowDown') return wrap(from + 1)
  if (key === 'ArrowLeft' || key === 'ArrowUp') return wrap(from - 1)
  return null
}

export interface RovingFocusOptions<T extends string> {
  values: readonly T[]
  value: T
  onChange: (value: T) => void
  /** 格狀排列時每列幾個 */
  columns?: number
}

/**
 * 單選群組的鍵盤模型：只有選中的在 Tab 順序裡，方向鍵切換，焦點跟著走。
 */
export function useRovingFocus<T extends string>({
  values,
  value,
  onChange,
  columns,
}: RovingFocusOptions<T>) {
  const elements = useRef(new Map<T, HTMLElement>())

  function onKeyDown(event: KeyboardEvent) {
    const next = nextIndex(values.indexOf(value), event.key, values.length, columns)
    if (next === null) return
    event.preventDefault()
    const target = values[next]
    if (target === undefined) return
    onChange(target)
    // 每個項目都已經渲染好了，所以可以立刻移焦點，不必等重繪。
    // 少了這一行，選取移動了但焦點框還留在舊的那一個上。
    elements.current.get(target)?.focus()
  }

  function itemProps(item: T) {
    return {
      ref: (el: HTMLElement | null) => {
        if (el) elements.current.set(item, el)
        else elements.current.delete(item)
      },
      tabIndex: (item === value ? 0 : -1) as 0 | -1,
    }
  }

  return { onKeyDown, itemProps }
}
