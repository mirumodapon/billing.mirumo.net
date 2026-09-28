import { buildExport, collectPhotos, type ExportOptions } from '../data/archive'
import type { BlobStore } from '../data/blobStore'
import { buildCsvFiles, type CsvNames } from '../data/csv'
import { deliverFile, type DeliveryResult } from '../data/deliverFile'
import type { TripRepository } from '../data/tripRepository'
import type { AppSettings, Snapshot } from '../data/types'
import { categoriesFor } from './categories'
import { displayName } from './names'
import { paymentMethodsFor } from './paymentMethods'

/** 上次成功匯出的時間（Plan 10 P8）。只給備份提醒用，不進備份本身 */
export const LAST_EXPORT_KEY = 'bi-last-export'

export function lastExportAt(): string | undefined {
  try {
    return localStorage.getItem(LAST_EXPORT_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function rememberExport(at: string): void {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, at)
  } catch {
    // 記不住只是會多提醒一次
  }
}

/** CSV 的名稱解析：全域的類別與付款方式，加上那一筆所屬旅程的專用項目（task#117） */
export function csvNamesFor(settings: AppSettings): CsvNames {
  return {
    category: (id, trip) => {
      const found = categoriesFor(settings.categories, trip ?? {}).find((c) => c.id === id)
      return found ? displayName(found) : id
    },
    paymentMethod: (id, trip) => {
      const found = paymentMethodsFor(settings.paymentMethods, trip ?? {}).find((m) => m.id === id)
      return found ? displayName(found) : id
    },
  }
}

/**
 * 匯出檔的預估大小（規格 4.8：按下去之前就知道會拿到 40KB 還是 60MB）。
 * 只是量級：JSON 用實際字串長度，CSV 約為 JSON 的一半，照片用存檔時記下的大小（Plan 10 P5）。
 */
export function estimateExportBytes(snapshot: Snapshot, options: ExportOptions): number {
  const json = JSON.stringify(snapshot, null, 2).length
  const photos = snapshot.expenses.filter((e) => !e.deletedAt).reduce((sum, e) => sum + e.attachments.reduce((s, a) => s + a.byteSize, 0), 0)
  return (options.json ? json : 0) + (options.csv ? Math.round(json / 2) : 0) + (options.includePhotos ? photos : 0)
}

/** 匯出一份備份並交給使用者。真的拿到檔案（分享或下載）才記下匯出時間 */
export async function runExport(
  stores: { repo: TripRepository; blobs: BlobStore },
  settings: AppSettings,
  options: ExportOptions,
  deliver: (file: File) => Promise<DeliveryResult> = deliverFile,
  now: Date = new Date(),
): Promise<DeliveryResult> {
  const snapshot = await stores.repo.exportSnapshot()
  const csv = options.csv ? buildCsvFiles(snapshot, csvNamesFor(settings)) : null
  const photos = options.includePhotos ? await collectPhotos(snapshot, stores.blobs) : new Map<string, Blob>()
  const file = await buildExport(snapshot, csv, photos, options, now)
  const result = await deliver(file)
  if (result !== 'cancelled') rememberExport(now.toISOString())
  return result
}
