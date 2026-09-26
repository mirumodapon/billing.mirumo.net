import type { Icon as TablerIcon } from '@tabler/icons-react'

export interface IconProps {
  /** Tabler 的圖示元件，如 IconPlus。務必逐一具名 import，不要整包帶進來 */
  glyph: TablerIcon
  size?: 'sm' | 'md' | 'lg'
  /** 給了才會被輔助科技讀到；純裝飾就別給 */
  label?: string
  'data-testid'?: string
}

const PX = { sm: 16, md: 20, lg: 24 } as const

export function Icon({ glyph: Glyph, size = 'md', label, ...rest }: IconProps) {
  return (
    <Glyph
      className="bi-icon"
      data-size={size}
      size={PX[size]}
      stroke={1.75}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    />
  )
}
