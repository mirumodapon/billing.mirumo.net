import type { Icon as TablerIcon } from '@tabler/icons-react'
import type { CSSProperties } from 'react'
import { useRovingFocus } from '../hooks/rovingFocus'
import { Icon } from '../icons/Icon'

export interface IconGridProps<K extends string> {
  icons: Readonly<Record<K, TablerIcon>>
  value: K
  onChange: (name: K) => void
  label: string
  /** 圖示沒有文字，每一格的名稱由呼叫端給 */
  labelFor: (name: K) => string
  /** 每列幾格，預設 6 */
  columns?: number
}

export function IconGrid<K extends string>({
  icons,
  value,
  onChange,
  label,
  labelFor,
  columns = 6,
}: IconGridProps<K>) {
  const names = Object.keys(icons) as K[]
  const { onKeyDown, itemProps } = useRovingFocus({ values: names, value, onChange, columns })
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bi-icon-grid"
      style={{ '--bi-icon-grid-columns': columns } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {names.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={name === value}
          className="bi-icon-grid__cell"
          onClick={() => onChange(name)}
          {...itemProps(name)}
        >
          <Icon glyph={icons[name]} size="lg" label={labelFor(name)} />
        </button>
      ))}
    </div>
  )
}
