import { IdbTripRepository } from '../data/tripRepository'
import { createSettingsStore } from '../stores/settingsStore'
import type { Stores } from '../stores/StoresProvider'
import { createTripStore } from '../stores/tripStore'
import { createUiStore } from '../stores/uiStore'

/** 正式環境的 store：開啟 IndexedDB 後建好三個 store */
export async function createAppStores(): Promise<Stores> {
  const repo = await IdbTripRepository.open()
  const ui = createUiStore()
  return { repo, ui, settings: createSettingsStore({ repo, ui }), trips: createTripStore({ repo, ui }) }
}
