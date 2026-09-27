import type { TablerIcon } from '@tabler/icons-react'
import { Icon } from '../icons/Icon'

export interface FabProps {
  glyph: TablerIcon
  /** 只有圖示的按鈕，這是輔助科技唯一能讀到的名稱 */
  ariaLabel: string
  onPress: () => void
}

export function Fab({ glyph, ariaLabel, onPress }: FabProps) {
  return (
    <button type="button" className="bi-fab" onClick={onPress}>
      <Icon glyph={glyph} size="lg" ariaLabel={ariaLabel} />
    </button>
  )
}
