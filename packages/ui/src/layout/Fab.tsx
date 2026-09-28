import type { TablerIcon } from '@tabler/icons-react'
import { Icon } from '../icons/Icon'

export interface FabProps {
  glyph: TablerIcon
  /** 只有圖示的按鈕，這是輔助科技唯一能讀到的名稱 */
  ariaLabel: string
  onPress: () => void
  /**
   * 畫面底下有沒有分頁列，預設有。沒有的畫面（例如旅程清單）傳 false，
   * 底部間距就只留 safe area，與右邊的距離一致（task#123）
   */
  overTabBar?: boolean
}

export function Fab({ glyph, ariaLabel, onPress, overTabBar = true }: FabProps) {
  return (
    <button type="button" className={overTabBar ? 'bi-fab' : 'bi-fab bi-fab--no-tabbar'} onClick={onPress}>
      <Icon glyph={glyph} size="lg" ariaLabel={ariaLabel} />
    </button>
  )
}
