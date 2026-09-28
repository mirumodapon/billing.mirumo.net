import { IdbBlobStore } from '../data/blobStore'
import { DraftStore } from '../data/drafts'
import { errorLog } from '../data/errorLog'
import { housekeep } from '../data/housekeeping'
import { IdbTripRepository } from '../data/tripRepository'
import { createSettingsStore } from '../stores/settingsStore'
import type { Stores } from '../stores/StoresProvider'
import { createTripStore } from '../stores/tripStore'
import { createUiStore } from '../stores/uiStore'

/** 正式環境的 store：開啟 IndexedDB 後建好三個 store */
export async function createAppStores(): Promise<Stores> {
  const [repo, drafts, blobs] = await Promise.all([IdbTripRepository.open(), DraftStore.open(), IdbBlobStore.open()])
  const ui = createUiStore()
  // 刪除超過寬限期的資料與沒人引用的照片（task#89、#118）。在背景做，不擋住第一個畫面；
  // 失敗只是這次沒清到，下次啟動再來，所以不打擾使用者
  void housekeep().catch((error: unknown) => errorLog.record(error))
  return { repo, drafts, blobs, ui, settings: createSettingsStore({ repo, ui }), trips: createTripStore({ repo, ui }) }
}
