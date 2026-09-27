import { IdbTripRepository } from '../data/tripRepository'
import { freshDbName, tickingClock } from '../data/testing/fixtures'

/** 每次一個新資料庫，時間由 tickingClock 提供，測試之間互不干擾 */
export async function openTestRepo(): Promise<IdbTripRepository> {
  return IdbTripRepository.open(freshDbName(), { now: tickingClock() })
}
