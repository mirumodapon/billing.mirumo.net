import { Suspense, use } from 'react'
import { HashRouter } from 'react-router'
import { StoresProvider, type Stores } from '../stores/StoresProvider'
import { AnimatedRoutes } from './AnimatedRoutes'
import { Boot } from './Boot'
import { BootSkeleton } from './BootSkeleton'
import { SnackbarHost } from './SnackbarHost'

/**
 * 收 Promise 而不是 store 本身：開啟 IndexedDB 是非同步的，但第一次繪製不能等它。
 * 等待期間 Suspense 畫骨架，開好了才掛上路由。
 */
export function App({ stores }: { stores: Promise<Stores> }) {
  return (
    <Suspense fallback={<BootSkeleton />}>
      <Root stores={stores} />
    </Suspense>
  )
}

function Root({ stores }: { stores: Promise<Stores> }) {
  const resolved = use(stores)
  return (
    <StoresProvider stores={resolved}>
      <HashRouter>
        <Boot>
          <AnimatedRoutes />
        </Boot>
      </HashRouter>
      <SnackbarHost store={resolved.ui} />
    </StoresProvider>
  )
}
