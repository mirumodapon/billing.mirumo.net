import type { AttachmentMeta } from '@billing/core'
import { Icon } from '@billing/ui'
import { IconPhotoOff, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useStores } from '../../stores/StoresProvider'
import { PhotoViewer } from './PhotoViewer'

export interface ReceiptThumbnailProps {
  meta: AttachmentMeta
  label: string
  /** 沒給就沒有移除鍵（檢視頁） */
  onRemove?: () => void
}

/**
 * 收據縮圖。點一下放大檢視（task#101）；取不到的照片（匯入不含照片的備份）
 * 顯示佔位而不是破圖（Plan 7 E7）。
 */
export function ReceiptThumbnail({ meta, label, onRemove }: ReceiptThumbnailProps) {
  const { t } = useI18n()
  const { blobs } = useStores()
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  const [viewing, setViewing] = useState(false)

  useEffect(() => {
    let revoked = false
    let created: string | undefined
    void blobs.get(meta.id).then((blob) => {
      if (revoked) return
      if (!blob) return setUrl(null)
      created = URL.createObjectURL(blob)
      setUrl(created)
    })
    return () => {
      revoked = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [blobs, meta.id])

  return (
    <figure className="relative m-0 h-20 w-20">
      {url ? (
        <button type="button" className="h-20 w-20 rounded-lg p-0" style={{ border: 0 }} aria-label={label} onClick={() => setViewing(true)}>
          <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />
        </button>
      ) : url === null ? (
        <div role="img" aria-label={t('receipt.missing')} className="app-card h-20 w-20 items-center justify-center p-1 text-center text-xs">
          <Icon glyph={IconPhotoOff} />
          <span>{t('receipt.missing')}</span>
        </div>
      ) : (
        <div className="app-card h-20 w-20" aria-hidden="true" />
      )}
      {onRemove ? (
        // 實心圓點，疊在任何照片上都看得見（task#130）
        <button type="button" className="app-thumb-remove" aria-label={t('receipt.remove')} onClick={onRemove}>
          <span className="app-thumb-remove__dot">
            <Icon glyph={IconX} size="sm" />
          </span>
        </button>
      ) : null}
      {viewing && url ? <PhotoViewer src={url} label={label} onClose={() => setViewing(false)} /> : null}
    </figure>
  )
}
