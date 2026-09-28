import { openTravelDb, type TravelDatabase } from './db'
import { StorageError } from './errors'

/** 收據照片的存放處（規格 7.1）。與 TripRepository 分開，日後可以各自換成雲端 */
export interface BlobStore {
  put(blob: Blob): Promise<string>
  get(id: string): Promise<Blob | undefined>
  delete(id: string): Promise<void>
  usage(): Promise<{ bytes: number; count: number }>
}

export class IdbBlobStore implements BlobStore {
  private constructor(
    private readonly db: TravelDatabase,
    private readonly now: () => string,
  ) {}

  static async open(name?: string, now: () => string = () => new Date().toISOString()): Promise<IdbBlobStore> {
    try {
      return new IdbBlobStore(await openTravelDb(name), now)
    } catch (error) {
      throw new StorageError('read', 'database', error)
    }
  }

  close(): void {
    this.db.close()
  }

  /** 存一張新照片，回傳新產生的 id（也就是 AttachmentMeta.id） */
  async put(blob: Blob): Promise<string> {
    const id = crypto.randomUUID()
    await this.restore(id, blob)
    return id
  }

  /**
   * 用指定的 id 存。匯入 zip 時用：photos/ 底下的檔名就是原本的 id（規格 13.2.1），
   * 照原 id 寫回，支出裡的 AttachmentMeta 才找得到它。
   */
  async restore(id: string, blob: Blob): Promise<void> {
    try {
      // 存位元組而不是 Blob：舊版 iOS Safari 的 IndexedDB 存 Blob 會失敗
      const bytes = await blob.arrayBuffer()
      await this.db.put('blobs', { id, type: blob.type, bytes, savedAt: this.now() })
    } catch (error) {
      throw new StorageError('write', 'blob', error)
    }
  }

  async get(id: string): Promise<Blob | undefined> {
    try {
      const row = await this.db.get('blobs', id)
      return row ? new Blob([row.bytes], { type: row.type }) : undefined
    } catch (error) {
      throw new StorageError('read', 'blob', error)
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.delete('blobs', id)
    } catch (error) {
      throw new StorageError('delete', 'blob', error)
    }
  }

  /** 設定頁顯示儲存用量用（規格 7.4） */
  async usage(): Promise<{ bytes: number; count: number }> {
    try {
      const rows = await this.db.getAll('blobs')
      return { bytes: rows.reduce((sum, row) => sum + row.bytes.byteLength, 0), count: rows.length }
    } catch (error) {
      throw new StorageError('read', 'blobs', error)
    }
  }
}
