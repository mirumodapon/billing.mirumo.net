import type { Icon as TablerIcon } from '@tabler/icons-react'
import type { KeyboardEvent } from 'react'
import { Icon } from '../icons/Icon'
import { SafeArea } from './SafeArea'

export interface TabItem {
  value: string
  label: string
  glyph: TablerIcon
}

export interface TabBarProps {
  tabs: readonly TabItem[]
  value: string
  onChange: (value: string) => void
  /** 整列的無障礙名稱 */
  label: string
}

export function TabBar({ tabs, value, onChange, label }: TabBarProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const index = tabs.findIndex((tab) => tab.value === value)
    // 取模再加長度再取模，負數才會繞到最後一個而不是變成 -1
    const next = tabs[(((index + delta) % tabs.length) + tabs.length) % tabs.length]
    if (next) onChange(next.value)
  }

  return (
    <SafeArea edges={['bottom', 'left', 'right']} data-testid="tabbar-safe">
      <div role="tablist" aria-label={label} className="bi-tabbar" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.value === value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              // 只有選中的留在 Tab 順序裡：tablist 的標準模型是「Tab 進來，
              // 方向鍵切換」。全部可 Tab 的話鍵盤使用者要按四次才走得掉
              tabIndex={selected ? 0 : -1}
              className="bi-tabbar__tab"
              onClick={() => onChange(tab.value)}
            >
              <Icon glyph={tab.glyph} />
              <span className="bi-tabbar__label">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </SafeArea>
  )
}
