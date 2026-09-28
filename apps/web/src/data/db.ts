import type { Expense, Transfer, Trip } from '@billing/core'
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppSettings } from './types'

export const DB_NAME = 'travel-split'
export const DB_VERSION = 1

/**
 * 收據照片存成位元組而不是 Blob。
 *
 * 兩個理由：舊版 iOS Safari 的 IndexedDB 存 Blob 會失敗（WebKit 的已知缺陷），
 * 存 ArrayBuffer 在所有瀏覽器都成立；而 jsdom 下的 fake-indexeddb 也存不了
 * Blob——實測存進去讀回來是一個空物件，測試會因此空轉。
 */
export interface BlobRow {
  id: string
  type: string
  bytes: ArrayBuffer
  /** 存進來的時間（task#89）。清理沒人引用的照片時留寬限期；舊版存的沒有這個欄位，視為很久以前 */
  savedAt?: string
}

export interface SettingsRow {
  key: 'app'
  settings: AppSettings
}

/** 填到一半的表單（規格 7.9）。每個路由最多一份 */
export interface DraftRow {
  route: string
  value: unknown
  savedAt: string
}

export interface TravelDb extends DBSchema {
  trips: { key: string; value: Trip }
  expenses: {
    key: string
    value: Expense
    indexes: { 'by-trip': string; 'by-trip-date': [string, string] }
  }
  transfers: { key: string; value: Transfer; indexes: { 'by-trip': string } }
  blobs: { key: string; value: BlobRow }
  settings: { key: string; value: SettingsRow }
  drafts: { key: string; value: DraftRow }
}

export type TravelDatabase = IDBPDatabase<TravelDb>

/**
 * 開啟資料庫並在需要時升級結構。
 *
 * 升級一律依 oldVersion 逐步往上，而不是依 newVersion 一次建好：使用者可能從
 * 任何舊版本直接跳到最新版，每一步都要各自成立（規格 7.8）。
 *
 * drafts 不在規格 7.2 的清單裡，但 7.9 要求草稿存在 IndexedDB，所以第一版就建。
 */
export function openTravelDb(name: string = DB_NAME): Promise<TravelDatabase> {
  return openDB<TravelDb>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('trips', { keyPath: 'id' })
        const expenses = db.createObjectStore('expenses', { keyPath: 'id' })
        expenses.createIndex('by-trip', 'tripId')
        expenses.createIndex('by-trip-date', ['tripId', 'date'])
        const transfers = db.createObjectStore('transfers', { keyPath: 'id' })
        transfers.createIndex('by-trip', 'tripId')
        db.createObjectStore('blobs', { keyPath: 'id' })
        db.createObjectStore('settings', { keyPath: 'key' })
        db.createObjectStore('drafts', { keyPath: 'route' })
      }
    },
  })
}
