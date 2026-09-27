import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { BlobStore } from './blobStore'
import { SnapshotError } from './errors'
import { migrateSnapshot } from './migrations'
import type { TripRepository } from './tripRepository'
import type { Snapshot } from './types'

export interface ExportOptions {
  json: boolean
  csv: boolean
  /** 預設關閉（規格 13.2.1） */
  includePhotos: boolean
}

const EXTENSIONS: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }
const MIME_BY_EXT: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }

/** 本機日期當檔名：travel-split-2026-09-24.zip */
function datedName(now: Date, ext: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `travel-split-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${ext}`
}

/**
 * 打包匯出檔（規格 13.2.1）。
 *
 * 規格說「選了一種以上格式或包含照片時打包成 zip，否則下載單一檔案」，但 CSV
 * 本身就是三個檔案，單一檔案裝不下。所以實際規則是：只有「只選 JSON 且不含照片」
 * 才輸出單一 .json，其餘一律 zip。
 *
 * 照片以原始位元組放進 photos/，不做 base64（會膨脹 33%，而照片正是備份裡最大的部分）。
 */
export async function buildExport(
  snapshot: Snapshot,
  csvFiles: Record<string, string> | null,
  photos: ReadonlyMap<string, Blob>,
  options: ExportOptions,
  now: Date = new Date(),
): Promise<File> {
  if (!options.json && !options.csv) throw new Error('choose at least one format')
  const json = JSON.stringify(snapshot, null, 2)

  if (options.json && !options.csv && !options.includePhotos) {
    return new File([json], datedName(now, 'json'), { type: 'application/json' })
  }

  const entries: Record<string, Uint8Array> = {}
  if (options.json) entries['data.json'] = strToU8(json)
  if (options.csv && csvFiles) for (const [name, text] of Object.entries(csvFiles)) entries[name] = strToU8(text)
  if (options.includePhotos) {
    for (const [id, blob] of photos) {
      entries[`photos/${id}.${EXTENSIONS[blob.type] ?? 'bin'}`] = new Uint8Array(await blob.arrayBuffer())
    }
  }
  // 照片本來就壓縮過，再壓只是浪費時間；文字檔壓縮效果好
  const zipped = zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([name, bytes]) => [name, [bytes, { level: name.startsWith('photos/') ? 0 : 6 }]]),
    ),
  )
  return new File([zipped], datedName(now, 'zip'), { type: 'application/zip' })
}

export interface ImportedFile {
  /** 尚未遷移、尚未驗證的原始內容 */
  raw: unknown
  /** zip 裡的照片，key 是 AttachmentMeta.id；純 JSON 備份時為空 */
  photos: Map<string, Blob>
  /** 是否來自 zip。純 JSON 備份不含照片，UI 要顯示佔位而不是破圖 */
  hadArchive: boolean
}

/**
 * 讀匯入檔。依檔頭判斷是不是 zip，而不是只看副檔名：使用者從通訊軟體存下來的
 * 檔案常常被改名或少了副檔名。CSV 不能匯入（規格 13.2.1）。
 */
export async function readImport(file: Blob): Promise<ImportedFile> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04

  if (!isZip) {
    try {
      return { raw: JSON.parse(strFromU8(bytes)), photos: new Map(), hadArchive: false }
    } catch {
      throw new SnapshotError(['this file is neither a backup (.json) nor a backup archive (.zip)'])
    }
  }

  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new SnapshotError(['the archive is damaged'])
  }
  const data = entries['data.json']
  if (!data) throw new SnapshotError(['the archive has no data.json — CSV exports cannot be imported'])

  let raw: unknown
  try {
    raw = JSON.parse(strFromU8(data))
  } catch {
    throw new SnapshotError(['data.json is not valid JSON'])
  }
  const photos = new Map<string, Blob>()
  for (const [path, content] of Object.entries(entries)) {
    const match = /^photos\/([^/]+)\.([a-z0-9]+)$/i.exec(path)
    if (!match) continue
    const [, id, ext] = match
    photos.set(id!, new Blob([content as BlobPart], { type: MIME_BY_EXT[ext!.toLowerCase()] ?? 'application/octet-stream' }))
  }
  return { raw, photos, hadArchive: true }
}

export interface ImportReport {
  photosRestored: number
  /** 支出引用了、但這份備份裡沒有的照片數。純 JSON 備份時就是全部 */
  photosMissing: number
}

/**
 * 整個匯入流程：讀檔 → 遷移 → 驗證並寫入帳務 → 寫回照片。
 *
 * 帳務先寫、照片後寫：帳務驗證失敗時一張照片都不會留下。只寫回有被支出引用的
 * 照片，zip 裡多餘的檔案不進資料庫。
 */
export async function importArchive(
  file: Blob,
  repo: TripRepository,
  blobs: BlobStore & { restore(id: string, blob: Blob): Promise<void> },
  mode: 'replace' | 'merge',
): Promise<ImportReport> {
  const imported = await readImport(file)
  const migrated = migrateSnapshot(imported.raw)
  if (!migrated.ok) throw new SnapshotError([migrated.problem])
  const snapshot = migrated.value as unknown as Snapshot
  await repo.importSnapshot(snapshot, mode)

  const wanted = new Set(snapshot.expenses.flatMap((e) => (e.deletedAt ? [] : e.attachments.map((a) => a.id))))
  let photosRestored = 0
  for (const id of wanted) {
    const blob = imported.photos.get(id)
    if (!blob) continue
    await blobs.restore(id, blob)
    photosRestored += 1
  }
  return { photosRestored, photosMissing: wanted.size - photosRestored }
}

/** 匯出時要放進 zip 的照片：只取未刪除支出引用到的 */
export async function collectPhotos(snapshot: Snapshot, blobs: BlobStore): Promise<Map<string, Blob>> {
  const photos = new Map<string, Blob>()
  for (const expense of snapshot.expenses) {
    if (expense.deletedAt) continue
    for (const attachment of expense.attachments) {
      const blob = await blobs.get(attachment.id)
      if (blob) photos.set(attachment.id, blob)
    }
  }
  return photos
}
