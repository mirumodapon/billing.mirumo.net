import { createContext, useContext, type ReactNode } from 'react'
import { useStore, type StoreApi } from 'zustand'
import type { BlobStore } from '../data/blobStore'
import type { DraftStore } from '../data/drafts'
import type { TripRepository } from '../data/tripRepository'
import type { SettingsState } from './settingsStore'
import type { TripState } from './tripStore'
import type { UiState } from './uiStore'

/** 整個 app 共用的 store 與 repository。以工廠建立、由這裡注入，測試才能換成自己的 */
export interface Stores {
  repo: TripRepository
  /** 填到一半的表單（規格 7.9） */
  drafts: Pick<DraftStore, 'save' | 'load' | 'discard'>
  /** 收據照片（規格 7.3） */
  blobs: BlobStore
  ui: StoreApi<UiState>
  settings: StoreApi<SettingsState>
  trips: StoreApi<TripState>
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

export function useTrips<T>(selector: (s: TripState) => T): T {
  return useStore(useStores().trips, selector)
}
