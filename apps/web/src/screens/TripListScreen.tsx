import { AppBar, Fab, Skeleton } from '@billing/ui'
import { IconPlus, IconSettings } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { useScrollRestore } from '../session/useScrollRestore'
import { useStores, useTrips } from '../stores/StoresProvider'
import { useConfirmDelete } from './forms/useConfirmDelete'
import { BackupReminderCard } from './BackupReminderCard'
import { InstallCard } from './InstallCard'
import { NewTripSheet } from './NewTripSheet'
import { TripCard } from './TripCard'

export function TripListScreen() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { trips: store } = useStores()
  const trips = useTrips((s) => s.trips)
  const summaries = useTrips((s) => s.summaries)
  const loaded = useTrips((s) => s.loaded)
  const [creating, setCreating] = useState(false)
  const confirm = useConfirmDelete()
  // 回到列表就放掉上一趟旅程的支出與轉帳（規格 7.5：首頁不載支出）
  useEffect(() => store.getState().closeTrip(), [store])
  const scroller = useRef<HTMLDivElement>(null)
  useScrollRestore(scroller, loaded)

  return (
    <div className="app-screen">
      <AppBar
        title={t('tripList.title')}
        action={{ glyph: IconSettings, ariaLabel: t('tripList.settings'), onPress: () => navigate('/settings') }}
      />
      <div ref={scroller} className="app-scroll">
        {!loaded ? (
          <div className="app-list" aria-busy="true" aria-label={t('common.loading')}>
            <Skeleton variant="rect" height="112px" />
            <Skeleton variant="rect" height="112px" />
          </div>
        ) : trips.length === 0 ? (
          <p className="app-empty">{t('tripList.empty')}</p>
        ) : (
          <div className="app-list">
            {/* 規格 7.4：先保住資料，再看帳——安裝引導與備份提醒放在最上面 */}
            <InstallCard hasTrips />
            <BackupReminderCard />
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                summary={summaries[trip.id]}
                onOpen={() => navigate(`/trip/${trip.id}/expenses`)}
                onDelete={() => confirm.ask(trip.name, 'undoable', () => void store.getState().deleteTrip(trip.id))}
              />
            ))}
          </div>
        )}
      </div>
      <Fab glyph={IconPlus} ariaLabel={t('trip.new')} onPress={() => setCreating(true)} />
      <NewTripSheet open={creating} onClose={() => setCreating(false)} />
      {confirm.dialog}
    </div>
  )
}
