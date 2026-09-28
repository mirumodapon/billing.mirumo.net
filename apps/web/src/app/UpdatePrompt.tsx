import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { flushAllDrafts } from '../data/drafts'
import { useI18n } from '../i18n/useI18n'
import { useStores } from '../stores/StoresProvider'

/**
 * 新版本的提示（規格 7.6）。registerType 是 prompt：自動更新會在填表填到一半時重載、
 * 弄丟沒存的支出，所以偵測到新版本只跳 snackbar，由使用者決定時機。
 * 按「立即更新」先把所有開著的表單草稿寫完（task#90），再換新版重載。
 */
export function UpdatePrompt() {
  const { t } = useI18n()
  const { ui } = useStores()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    ui.getState().show({
      id: 'update',
      message: t('update.available'),
      actionLabel: t('update.now'),
      onAction: () =>
        void (async () => {
          await flushAllDrafts()
          await updateServiceWorker(true)
        })(),
    })
  }, [needRefresh, ui, t, updateServiceWorker])

  return null
}
