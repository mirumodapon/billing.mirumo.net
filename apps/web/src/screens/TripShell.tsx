import { AppBar, TabBar } from '@billing/ui'
import { IconChartDonut, IconListDetails, IconSettings, IconTransfer } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { useScrollRestore } from '../session/useScrollRestore'
import { useStores, useTrips } from '../stores/StoresProvider'

const TABS = ['expenses', 'stats', 'settle', 'setup'] as const
const GLYPHS = { expenses: IconListDetails, stats: IconChartDonut, settle: IconTransfer, setup: IconSettings }

/** 進入旅程後的外框：頂列、可捲動的內容、底部四分頁（規格 4.1） */
export function TripShell() {
  const { tripId = '' } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { trips } = useStores()
  const trip = useTrips((s) => s.trips.find((x) => x.id === tripId))
  const ready = useTrips((s) => s.current?.tripId === tripId)
  const scroller = useRef<HTMLDivElement>(null)
  useScrollRestore(scroller, ready)

  useEffect(() => {
    // 讀當下的狀態而不是 render 時的值：StrictMode 的模擬卸載會先 closeTrip，
    // 重新掛載時若沿用舊值，會以為已經載入而什麼都不做
    if (trips.getState().current?.tripId !== tripId) void trips.getState().openTrip(tripId)
    return () => trips.getState().closeTrip()
  }, [trips, tripId])

  // 清單裡沒有就是不存在或已刪除：回列表，不顯示錯誤
  if (!trip) return <Navigate to="/" replace />

  const tab = TABS.find((x) => pathname.endsWith(`/${x}`)) ?? 'expenses'
  return (
    <div className="flex h-dvh flex-col">
      <AppBar title={trip.name} onBack={() => navigate('/')} backLabel={t('common.back')} />
      <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar
        ariaLabel={t('tab.label')}
        value={tab}
        tabs={TABS.map((value) => ({ value, label: t(`tab.${value}`), glyph: GLYPHS[value] }))}
        // tab 之間用 replace：切 tab 不該累積返回紀錄，返回鍵應該直接回旅程列表
        onChange={(value) => navigate(`/trip/${tripId}/${value}`, { replace: true })}
      />
    </div>
  )
}
