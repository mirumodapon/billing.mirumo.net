import { Avatar } from '../primitives/Avatar'

export interface AvatarToggleItem {
  value: string
  name: string
  colorKey: string
}

export interface AvatarToggleGroupProps {
  items: readonly AvatarToggleItem[]
  selected: readonly string[]
  /** 回傳依 items 順序排列的新選取 */
  onChange: (selected: string[]) => void
  label: string
  /** 至少要保留幾個。預設 0 */
  minSelected?: number
}

export function AvatarToggleGroup({
  items,
  selected,
  onChange,
  label,
  minSelected = 0,
}: AvatarToggleGroupProps) {
  function toggle(value: string) {
    const isOn = selected.includes(value)
    if (isOn && selected.length <= minSelected) return
    const next = new Set(selected)
    if (isOn) next.delete(value)
    else next.add(value)
    // 依項目順序輸出，而不是點擊順序
    onChange(items.filter((item) => next.has(item.value)).map((item) => item.value))
  }

  return (
    <div role="group" aria-label={label} className="bi-avatar-toggle">
      {items.map((item) => {
        const pressed = selected.includes(item.value)
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={pressed}
            className="bi-avatar-toggle__item"
            onClick={() => toggle(item.value)}
          >
            <Avatar name={item.name} colorKey={item.colorKey} outlined={!pressed} />
            {/* 頭像已經帶著姓名作為無障礙名稱，這行字再念一次就重複了 */}
            <span className="bi-avatar-toggle__name" aria-hidden="true">
              {item.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
