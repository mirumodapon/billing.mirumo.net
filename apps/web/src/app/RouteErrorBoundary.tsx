import { Button, SafeArea } from '@billing/ui'
import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { errorLog } from '../data/errorLog'
import { runExport } from '../domain/backup'
import { useI18n } from '../i18n/useI18n'
import { useSettings, useStores } from '../stores/StoresProvider'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * 每個路由外面的錯誤邊界（規格 7.7）：畫面出錯時換成自製的錯誤畫面，錯誤寫進本機記錄。
 * 以路由為 key 掛載，換頁就重新開始，一頁壞掉不會拖垮整個 app。
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    errorLog.record(Object.assign(error, { stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}` }))
  }

  render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children
  }
}

/**
 * 錯誤畫面。app 出事時使用者最怕的是資料沒了，所以這裡直接給「匯出資料」——
 * 給一條逃生路比道歉有用（規格 7.7）。
 */
function ErrorScreen() {
  const { t } = useI18n()
  const stores = useStores()
  const settings = useSettings((s) => s.settings)
  const [exported, setExported] = useState<'idle' | 'done' | 'failed'>('idle')

  const exportData = async () => {
    try {
      const result = await runExport(stores, settings, { json: true, csv: false, includePhotos: true })
      if (result !== 'cancelled') setExported('done')
    } catch {
      setExported('failed')
    }
  }

  return (
    <div className="app-screen" role="alert">
      <SafeArea edges={['top', 'left', 'right']}>
        <div className="app-form p-6">
          <h1 className="app-card__title">{t('crash.title')}</h1>
          <p className="app-field-label m-0">{t('crash.hint')}</p>
          <Button onClick={() => void exportData()}>{t('crash.export')}</Button>
          {exported === 'done' ? <p className="app-field-label m-0">{t('backup.exported')}</p> : null}
          {exported === 'failed' ? <p className="app-error m-0">{t('backup.exportFailed')}</p> : null}
          <Button variant="secondary" onClick={() => location.reload()}>
            {t('crash.reload')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              location.hash = '#/'
              location.reload()
            }}
          >
            {t('crash.home')}
          </Button>
        </div>
      </SafeArea>
    </div>
  )
}
