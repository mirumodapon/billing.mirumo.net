import { createSettingsStore } from '../stores/settingsStore'
import type { Stores } from '../stores/StoresProvider'
import { createUiStore } from '../stores/uiStore'
import { IdbTripRepository } from '../data/tripRepository'
import { freshDbName, tickingClock } from '../data/testing/fixtures'

/** 每次一個新資料庫，時間由 tickingClock 提供，測試之間互不干擾 */
export async function openTestRepo(): Promise<IdbTripRepository> {
  return IdbTripRepository.open(freshDbName(), { now: tickingClock() })
}

/** 測試用的一整組 store，接在一個全新的資料庫上 */
export async function makeStores(): Promise<Stores> {
  const repo = await openTestRepo()
  const ui = createUiStore()
  const settings = createSettingsStore({ repo, ui })
  return { repo, ui, settings }
}
