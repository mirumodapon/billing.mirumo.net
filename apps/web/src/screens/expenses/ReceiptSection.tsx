import type { AttachmentMeta } from '@billing/core'
import { Accordion, Button, Icon } from '@billing/ui'
import { IconCamera, IconPhotoOff, IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { compressImage } from '../../data/compressImage'
import { useI18n } from '../../i18n/useI18n'
import { useStores } from '../../stores/StoresProvider'
import type { FormSectionProps } from './ExpenseFormScreen'

/**
 * 收據照片（規格 7.3）。拍照後立刻壓縮再存，原圖不落地。
 *
 * 移除只把照片從這一筆拿掉，不刪 Blob：使用者可能不存檔就離開，那時舊版本
 * 仍然引用它。孤兒照片的清理另外處理（task）。
 */
export function ReceiptSection({ draft, change, open, onToggle }: FormSectionProps & { open: boolean; onToggle: () => void }) {
  const { t, tPlural } = useI18n()
  const { blobs, ui } = useStores()
  const input = useRef<HTMLInputElement>(null)
  const count = draft.attachments.length

  const add = async (file: File) => {
    try {
      const { blob, width, height } = await compressImage(file)
      const id = await blobs.put(blob)
      const meta: AttachmentMeta = { id, mimeType: blob.type, byteSize: blob.size, width, height }
      change((d) => ({ ...d, attachments: [...d.attachments, meta] }))
    } catch {
      ui.getState().show({ id: 'receipt-failed', message: t('receipt.failed') })
    }
  }

  return (
    <Accordion
      title={t('receipt.title')}
      summary={count === 0 ? t('receipt.none') : tPlural('receipt.count', { count })}
      open={open}
      onToggle={onToggle}
      data-testid="section-receipt"
    >
      <div className="app-form">
        <div className="flex flex-wrap gap-3">
          {draft.attachments.map((meta, index) => (
            <Thumbnail
              key={meta.id}
              meta={meta}
              label={t('receipt.photo', { n: index + 1 })}
              onRemove={() => change((d) => ({ ...d, attachments: d.attachments.filter((a) => a.id !== meta.id) }))}
            />
          ))}
        </div>
        {/* 規格 5.7：相機與相簿是 OS 的介面，網頁無權取代；原生的檔案欄位藏在自製按鈕後面 */}
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          data-testid="receipt-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void add(file)
          }}
        />
        <Button variant="secondary" onClick={() => input.current?.click()}>
          <Icon glyph={IconCamera} /> {t('receipt.add')}
        </Button>
      </div>
    </Accordion>
  )
}

function Thumbnail({ meta, label, onRemove }: { meta: AttachmentMeta; label: string; onRemove: () => void }) {
  const { t } = useI18n()
  const { blobs } = useStores()
  const [url, setUrl] = useState<string | null | undefined>(undefined)

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
        <img src={url} alt={label} className="h-20 w-20 rounded-lg object-cover" />
      ) : url === null ? (
        // 匯入不含照片的備份後（Plan 7 E7）：佔位而不是破圖
        <div role="img" aria-label={t('receipt.missing')} className="app-card h-20 w-20 items-center justify-center p-1 text-center text-xs">
          <Icon glyph={IconPhotoOff} />
          <span>{t('receipt.missing')}</span>
        </div>
      ) : (
        <div className="app-card h-20 w-20" aria-hidden="true" />
      )}
      <span className="absolute -right-2 -top-2">
        <Button variant="ghost" aria-label={t('receipt.remove')} onClick={onRemove}>
          <Icon glyph={IconX} />
        </Button>
      </span>
    </figure>
  )
}
