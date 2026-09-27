import { useRovingFocus } from '../hooks/rovingFocus'

export interface ColorSwatchesProps {
  /** accent 槽位名稱，如 accent1…accent12 */
  keys: readonly string[]
  value: string
  onChange: (key: string) => void
  label: string
  /** 色塊沒有文字，每一格的名稱由呼叫端給 */
  labelFor: (key: string) => string
}

export function ColorSwatches({ keys, value, onChange, label, labelFor }: ColorSwatchesProps) {
  const { onKeyDown, itemProps } = useRovingFocus({ values: keys, value, onChange })
  return (
    <div role="radiogroup" aria-label={label} className="bi-swatches" onKeyDown={onKeyDown}>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={key === value}
          aria-label={labelFor(key)}
          className="bi-swatches__option"
          onClick={() => onChange(key)}
          {...itemProps(key)}
        >
          <span
            data-testid={`swatch-${key}`}
            className="bi-swatches__color"
            style={{ background: `var(--bi-${key})` }}
          />
        </button>
      ))}
    </div>
  )
}
