import { IconChevronLeft, type Icon as TablerIcon } from '@tabler/icons-react'
import { Icon } from '../icons/Icon'
import { SafeArea } from './SafeArea'

export interface AppBarAction {
  glyph: TablerIcon
  /** 只有圖示的按鈕，這個名稱是輔助科技唯一能讀到的東西 */
  ariaLabel: string
  onPress: () => void
}

export interface AppBarProps {
  title: string
  onBack?: () => void
  /** 返回鍵的無障礙名稱。有 onBack 時必須給 */
  backLabel?: string
  action?: AppBarAction
}

export function AppBar({ title, onBack, backLabel = '返回', action }: AppBarProps) {
  return (
    <SafeArea edges={['top', 'left', 'right']} data-testid="appbar-safe">
      <header className="bi-appbar">
        {/*
         * 左右各一個固定寬度的槽，空的時候也佔位。少了這個，只有返回鍵
         * 的畫面標題會被推向右邊，而使用者在頁與頁之間看到的是標題在跳動
         */}
        <div className="bi-appbar__slot" data-testid="appbar-slot">
          {onBack ? (
            <button type="button" className="bi-appbar__button" onClick={onBack}>
              <Icon glyph={IconChevronLeft} size="lg" ariaLabel={backLabel} />
            </button>
          ) : null}
        </div>
        <h1 className="bi-appbar__title">{title}</h1>
        <div className="bi-appbar__slot" data-testid="appbar-slot">
          {action ? (
            <button type="button" className="bi-appbar__button" onClick={action.onPress}>
              <Icon glyph={action.glyph} size="lg" ariaLabel={action.ariaLabel} />
            </button>
          ) : null}
        </div>
      </header>
    </SafeArea>
  )
}
