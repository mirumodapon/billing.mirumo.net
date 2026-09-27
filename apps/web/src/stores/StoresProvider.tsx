import { createContext, useContext, type ReactNode } from 'react'
import { useStore, type StoreApi } from 'zustand'
import type { TripRepository } from '../data/tripRepository'
import type { SettingsState } from './settingsStore'
import type { UiState } from './uiStore'

/** 整個 app 共用的 store 與 repository。以工廠建立、由這裡注入，測試才能換成自己的 */
export interface Stores {
  repo: TripRepository
  ui: StoreApi<UiState>
  settings: StoreApi<SettingsState>
}

const StoresContext = createContext<Stores | null>(null)

export function StoresProvider({ stores, children }: { stores: Stores; children: ReactNode }) {
  return <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>
}

export function useStores(): Stores {
  const stores = useContext(StoresContext)
  // 開發期立刻發現漏包 Provider，而不是在某個深處讀到 undefined
  if (!stores) throw new Error('StoresProvider is missing')
  return stores
}

export function useUi<T>(selector: (s: UiState) => T): T {
  return useStore(useStores().ui, selector)
}

export function useSettings<T>(selector: (s: SettingsState) => T): T {
  return useStore(useStores().settings, selector)
}
