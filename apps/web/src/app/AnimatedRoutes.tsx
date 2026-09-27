import { PageTransition } from '@billing/ui'
import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { PlaceholderTab } from '../screens/PlaceholderTab'
import { SettingsScreen } from '../screens/settings/SettingsScreen'
import { SetupTab } from '../screens/setup/SetupTab'
import { TripListScreen } from '../screens/TripListScreen'
import { TripShell } from '../screens/TripShell'

/** 第一層路由：換這一層才播頁面動畫，旅程內切 tab 不播 */
export function pageKeyOf(pathname: string): string {
  const trip = /^\/trip\/([^/]+)/.exec(pathname)
  if (trip) return `/trip/${trip[1]}`
  return pathname === '/settings' ? '/settings' : '/'
}

const depthOf = (key: string) => (key === '/' ? 0 : 1)

export function AnimatedRoutes() {
  const location = useLocation()
  const key = pageKeyOf(location.pathname)
  // 方向取決於「從哪裡來」：往深處走由右滑入，回到列表由左滑回（規格 5.5）
  const [page, setPage] = useState({ key, direction: 'forward' as 'forward' | 'back' })
  if (page.key !== key) setPage({ key, direction: depthOf(key) >= depthOf(page.key) ? 'forward' : 'back' })

  return (
    <PageTransition routeKey={key} direction={page.direction}>
      <Routes location={location}>
        <Route path="/" element={<TripListScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/trip/:tripId" element={<TripShell />}>
          <Route path="expenses" element={<PlaceholderTab />} />
          <Route path="stats" element={<PlaceholderTab />} />
          <Route path="settle" element={<PlaceholderTab />} />
          <Route path="setup" element={<SetupTab />} />
          <Route index element={<Navigate to="expenses" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageTransition>
  )
}
