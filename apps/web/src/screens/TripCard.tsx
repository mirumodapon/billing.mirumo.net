import type { Trip } from '@billing/core'
import { ProgressBar, SwipeAction } from '@billing/ui'
import { IconTrash } from '@tabler/icons-react'
import type { TripSummary } from '../domain/summarizeTrips'
import { useI18n } from '../i18n/useI18n'

export interface TripCardProps {
  trip: Trip
  summary?: TripSummary
  onOpen: () => void
  onDelete: () => void
}

/** 旅程列表的一張卡片（規格 4.2）：左滑露出刪除，刪除走 snackbar 復原 */
export function TripCard({ trip, summary, onOpen, onDelete }: TripCardProps) {
  const { t, money, dateRange } = useI18n()
  const budget = summary?.budget
  return (
    <SwipeAction glyph={IconTrash} actionLabel={t('common.delete')} onAction={onDelete}>
      <button type="button" className="app-card" onClick={onOpen}>
        <h2 className="app-card__title">{trip.name}</h2>
        <span className="app-card__meta">
          {trip.destination ? <span>{trip.destination}</span> : null}
          <span>{dateRange(trip.startDate, trip.endDate)}</span>
        </span>
        <span className="app-card__meta app-money">
          {t('tripList.spent', { amount: money(summary?.spentMinor ?? 0, trip.baseCurrency) })}
        </span>
        {/* 規格 3.6：沒設預算就不畫，不是畫一條空的 */}
        {budget ? (
          <ProgressBar
            ratio={budget.ratio}
            level={budget.level}
            // 預算為 0 卻有花費時 ratio 是 Infinity；說明文字封頂，條子本身由 ProgressBar 處理
            ariaLabel={t('tripList.budget', { percent: Math.min(999, Math.round(budget.ratio * 100)) })}
          />
        ) : (
          // task#116：沒有預算也留出進度條的高度，列表裡每張卡片一樣高
          <span className="app-card__bar-slot" aria-hidden="true" />
        )}
      </button>
    </SwipeAction>
  )
}
