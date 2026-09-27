import { useRovingFocus } from '../hooks/rovingFocus'

export interface ChipOption {
  value: string
  label: string
  /** accent 槽位名稱，給了才畫色點 */
  colorKey?: string
}

export interface ChipGroupProps {
  options: readonly ChipOption[]
  value: string
  onChange: (value: string) => void
  label: string
}

export function ChipGroup({ options, value, onChange, label }: ChipGroupProps) {
  const { onKeyDown, itemProps } = useRovingFocus({
    values: options.map((o) => o.value),
    value,
    onChange,
  })
  return (
    <div role="radiogroup" aria-label={label} className="bi-chip-group" onKeyDown={onKeyDown}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          // 只借 Chip 的樣式，不用 Chip 元件：它輸出 aria-pressed（切換按鈕的語意），
          // 而單選群組的子項必須是 radio + aria-checked
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className="bi-chip"
            data-selected={selected || undefined}
            onClick={() => onChange(option.value)}
            {...itemProps(option.value)}
          >
            {option.colorKey ? (
              <span
                data-testid="chip-dot"
                className="bi-chip__dot"
                style={{ background: `var(--bi-${option.colorKey})` }}
              />
            ) : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
