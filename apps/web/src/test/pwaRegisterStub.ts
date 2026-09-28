import { act } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { vi } from 'vitest'

/**
 * 測試用的 `virtual:pwa-register/react`。那是 vite-plugin-pwa 在建置時才產生的虛擬模組，
 * vitest 裡不存在；vitest.config 把它指到這裡。測試用 announceUpdate() 模擬「有新版本」。
 */
let needRefresh = false
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const updateServiceWorker = vi.fn<(reload?: boolean) => Promise<void>>(async () => {})

export function useRegisterSW() {
  const value = useSyncExternalStore(subscribe, () => needRefresh)
  const noop = () => {}
  return {
    needRefresh: [value, noop] as [boolean, (value: boolean) => void],
    offlineReady: [false, noop] as [boolean, (value: boolean) => void],
    updateServiceWorker,
  }
}

export function announceUpdate(): void {
  act(() => {
    needRefresh = true
    for (const listener of listeners) listener()
  })
}

/** 每個測試之後還原，避免「有新版本」漏到下一個測試 */
export function resetUpdate(): void {
  needRefresh = false
  updateServiceWorker.mockClear()
}
