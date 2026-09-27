import { Skeleton } from '@billing/ui'
import { t } from '../i18n'

/**
 * 資料還沒回來時的整頁骨架（規格 5.2：不用轉圈圈）。
 * aria-busy 讓螢幕閱讀器知道這一區正在載入，而不是念出一堆空白（task#70）。
 */
export function BootSkeleton() {
  return (
    <div data-testid="boot" aria-busy="true" aria-label={t('common.loading')} className="flex flex-col gap-3 p-4">
      <Skeleton variant="rect" height="56px" />
      <Skeleton variant="rect" height="96px" />
      <Skeleton variant="rect" height="96px" />
    </div>
  )
}
