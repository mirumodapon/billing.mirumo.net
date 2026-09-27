import type { Trip } from '@billing/core'
import { Accordion, Button } from '@billing/ui'
import { useNavigate } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { useStores } from '../../stores/StoresProvider'

export interface DeleteTripSectionProps {
  trip: Trip
  open: boolean
  onToggle: () => void
}

/** 刪除旅程（規格 4.7）。不跳確認：軟刪除 + snackbar 復原（規格 4.2） */
export function DeleteTripSection({ trip, open, onToggle }: DeleteTripSectionProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { trips } = useStores()

  const remove = () => {
    // 明確轉回列表。就算不轉，TripShell 看到旅程從清單消失也會自己 replace 回列表——
    // 那是退路（例如別處刪掉了旅程），不是這裡要依賴的路徑。兩者都用 replace，
    // 返回鍵不會回到一個已刪除的旅程
    navigate('/', { replace: true })
    void trips.getState().deleteTrip(trip.id)
  }

  return (
    <Accordion title={t('setup.delete')} open={open} onToggle={onToggle} data-testid="section-delete">
      <div className="app-form">
        <p className="app-field-label">{t('setup.deleteHint')}</p>
        <Button variant="danger" onClick={remove}>
          {t('setup.delete')}
        </Button>
      </div>
    </Accordion>
  )
}
