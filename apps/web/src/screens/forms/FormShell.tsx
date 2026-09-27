import { Button, Chip, Dialog, Icon, SafeArea } from '@billing/ui'
import { IconX } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import type { useFormDraft } from './useFormDraft'

export interface FormShellProps<T> {
  title: string
  /** 還有欄位沒填完：照樣可以存，但一律存成草稿（task#96） */
  incomplete: boolean
  /** 使用者自己要存成草稿 */
  isDraft: boolean
  onDraftChange: (isDraft: boolean) => void
  /** 存檔；回傳是否成功。成功後外框負責刪草稿與離開 */
  onSave: () => Promise<boolean>
  drafted: ReturnType<typeof useFormDraft<T>>
  /** 直接由 session 還原進來、前面沒有頁面時，關閉後要去的地方 */
  fallback: string
  /** version 在捨棄還原的草稿時遞增：內容要整個重新掛載，金額欄才不會顯示舊的算式 */
  children: (version: number) => ReactNode
}

/**
 * 全螢幕表單的外框（支出、轉帳共用）：頂列 ✕／標題／儲存、草稿還原提示、
 * 離開時的「保留草稿／捨棄」（規格 4.4、7.9）。
 */
export function FormShell<T>({ title, incomplete, isDraft, onDraftChange, onSave, drafted, fallback, children }: FormShellProps<T>) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [version, setVersion] = useState(0)
  const [asking, setAsking] = useState(false)
  const asDraft = incomplete || isDraft

  // 從別頁推進來的就退回去；前面沒有頁面時改去 fallback，不是退出 app
  const leave = () => (location.key !== 'default' ? navigate(-1) : navigate(fallback, { replace: true }))

  const save = async () => {
    if (!(await onSave())) return
    await drafted.abandon()
    leave()
  }

  // 規格 7.9：主動按 ✕ 離開時，有改過才詢問保留或捨棄
  const close = async () => {
    if (drafted.dirty) return setAsking(true)
    await drafted.abandon()
    leave()
  }

  return (
    <div className="app-screen">
      <SafeArea edges={['top', 'left', 'right']}>
        <header className="app-form-header">
          <Button variant="ghost" aria-label={t('form.close')} onClick={() => void close()}>
            <Icon glyph={IconX} />
          </Button>
          <h1 className="app-form-header__title">{title}</h1>
          <Button onClick={() => void save()}>{asDraft ? t('form.saveDraft') : t('form.save')}</Button>
        </header>
      </SafeArea>
      {/* 沒填完時切換鍵鎖在「草稿」：那時存成正式紀錄會算錯帳 */}
      <div className="flex items-center gap-3 px-4 py-2 text-sm">
        <Chip label={t('record.draft')} selected={asDraft} disabled={incomplete} onSelect={() => onDraftChange(!isDraft)} />
        <span data-testid="draft-hint" style={{ color: 'var(--bi-text-muted)' }}>
          {incomplete ? t('form.draftForced') : asDraft ? t('form.draftHint') : null}
        </span>
      </div>
      {drafted.restored ? (
        <div role="status" data-testid="draft-banner" className="flex items-center justify-between gap-2 px-4 py-2 text-sm" style={{ background: 'var(--bi-surface)' }}>
          <span>{t('draft.restored')}</span>
          <Button
            variant="ghost"
            onClick={() => {
              drafted.discardRestored()
              setVersion((v) => v + 1)
            }}
          >
            {t('draft.discard')}
          </Button>
        </div>
      ) : null}
      <div className="app-scroll">{children(version)}</div>
      {/*
        Escape 與點背景都會觸發 onCancel，所以「保留草稿」放在取消、「捨棄」放在確認：
        誤觸時留下草稿，不會丟資料
      */}
      <Dialog
        open={asking}
        title={t('draft.leaveTitle')}
        description={t('draft.leaveHint')}
        confirmLabel={t('draft.discard')}
        cancelLabel={t('draft.keep')}
        destructive
        onConfirm={() => {
          setAsking(false)
          void drafted.abandon().then(leave)
        }}
        onCancel={() => {
          setAsking(false)
          void drafted.keep().then(leave)
        }}
      />
    </div>
  )
}
