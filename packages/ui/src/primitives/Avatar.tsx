import type { CSSProperties } from 'react'

export interface AvatarProps {
  name: string
  /** accent 槽位名稱，如 'accent5' */
  colorKey?: string
  size?: 'sm' | 'md' | 'lg'
  /** 空心樣式，供 Plan 3 的 AvatarToggleGroup 表示未選中 */
  outlined?: boolean
}

export function Avatar({ name, colorKey = 'accent8', size = 'md', outlined = false }: AvatarProps) {
  // Array.from 按 code point 切；name[0] 會把代理對切成半個字元
  const initial = Array.from(name)[0] ?? ''
  return (
    <span
      role="img"
      aria-label={name}
      className="bi-avatar"
      data-size={size}
      data-outlined={outlined || undefined}
      // 用自訂屬性帶顏色，而不是直接設 background：outlined 變體才能用同一個
      // 值畫外框，不必靠 !important 蓋掉這裡的 inline style
      style={{ '--bi-avatar-color': `var(--bi-${colorKey})` } as CSSProperties}
    >
      {initial}
    </span>
  )
}
