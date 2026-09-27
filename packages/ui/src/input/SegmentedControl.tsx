import { useRovingFocus } from '../hooks/rovingFocus'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  const { onKeyDown, itemProps } = useRovingFocus({
    values: options.map((o) => o.value),
    value,
    onChange,
  })
  return (
    <div role="radiogroup" aria-label={label} className="bi-segmented" onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className="bi-segmented__option"
          onClick={() => onChange(option.value)}
          {...itemProps(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
