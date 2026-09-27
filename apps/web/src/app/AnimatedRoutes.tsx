import { PageTransition } from '@billing/ui'
import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { ExpenseFormScreen } from '../screens/expenses/ExpenseFormScreen'
import { ExpensesTab } from '../screens/expenses/ExpensesTab'
import { PlaceholderTab } from '../screens/PlaceholderTab'
import { SettingsScreen } from '../screens/settings/SettingsScreen'
import { SetupTab } from '../screens/setup/SetupTab'
import { TripListScreen } from '../screens/TripListScreen'
import { TripShell } from '../screens/TripShell'
import { TransferFormScreen } from '../screens/transfers/TransferFormScreen'

export type PageDirection = 'forward' | 'back' | 'up' | 'down'

/** 換頁動畫的單位：旅程內切 tab 不算換頁，全螢幕表單算 */
export function pageKeyOf(pathname: string): string {
  const form = /^\/trip\/([^/]+)\/(expense|transfer)\/([^/]+)/.exec(pathname)
  if (form) return `/trip/${form[1]}/${form[2]}/${form[3]}`
  const trip = /^\/trip\/([^/]+)/.exec(pathname)
  if (trip) return `/trip/${trip[1]}`
  return pathname === '/settings' ? '/settings' : '/'
}

const depthOf = (key: string) => (key === '/' ? 0 : /\/(expense|transfer)\//.test(key) ? 2 : 1)
const isForm = (key: string) => depthOf(key) === 2

/**
 * 規格 5.5：往深處走由右滑入、回來由左滑回；規格 4.1：全螢幕表單由下往上推入，
 * 關掉時往下收。
 */
export function directionBetween(from: string, to: string): PageDirection {
  if (isForm(to) && !isForm(from)) return 'up'
  if (isForm(from) && !isForm(to)) return 'down'
  return depthOf(to) >= depthOf(from) ? 'forward' : 'back'
}

export function AnimatedRoutes() {
  const location = useLocation()
  const key = pageKeyOf(location.pathname)
  const [page, setPage] = useState({ key, direction: 'forward' as PageDirection })
  if (page.key !== key) setPage({ key, direction: directionBetween(page.key, key) })

  return (
    <PageTransition routeKey={key} direction={page.direction}>
      <Routes location={location}>
        <Route path="/" element={<TripListScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/trip/:tripId/expense/:expenseId" element={<ExpenseFormScreen />} />
        <Route path="/trip/:tripId/transfer/:transferId" element={<TransferFormScreen />} />
        <Route path="/trip/:tripId" element={<TripShell />}>
          <Route path="expenses" element={<ExpensesTab />} />
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
