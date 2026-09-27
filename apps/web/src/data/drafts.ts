import { openTravelDb, type TravelDatabase } from './db'
import { StorageError } from './errors'

/**
 * 填到一半的表單（規格 7.9）。它是使用者的真實內容，不能丟，所以進 IndexedDB
 * 而不是 localStorage。每個路由最多一份。
 */
export class DraftStore {
  private constructor(
    private readonly db: TravelDatabase,
    private readonly now: () => string,
  ) {}

  static async open(name?: string, now: () => string = () => new Date().toISOString()): Promise<DraftStore> {
    try {
      return new DraftStore(await openTravelDb(name), now)
    } catch (error) {
      throw new StorageError('read', 'database', error)
    }
  }

  close(): void {
    this.db.close()
  }

  async save(route: string, value: unknown): Promise<void> {
    try {
      await this.db.put('drafts', { route, value, savedAt: this.now() })
    } catch (error) {
      throw new StorageError('write', 'draft', error)
    }
  }

  async load(route: string): Promise<{ value: unknown; savedAt: string } | undefined> {
    try {
      const row = await this.db.get('drafts', route)
      return row ? { value: row.value, savedAt: row.savedAt } : undefined
    } catch (error) {
      throw new StorageError('read', 'draft', error)
    }
  }

  /** 儲存成功或使用者選擇捨棄時呼叫 */
  async discard(route: string): Promise<void> {
    try {
      await this.db.delete('drafts', route)
    } catch (error) {
      throw new StorageError('delete', 'draft', error)
    }
  }
}

export interface DraftWriter {
  /** 表單每次變更時呼叫；實際寫入延後 delay 毫秒，期間的變更合併成一次 */
  update(value: unknown): void
  /** 立刻寫入還沒寫的內容。頁面要被切到背景時呼叫 */
  flush(): Promise<void>
  /** 放棄還沒寫的內容，不寫入 */
  cancel(): void
}

/**
 * 表單欄位變更時 debounce 300ms 寫入草稿（規格 7.9）。
 *
 * 不是每按一個鍵就寫：那會在打字時產生幾十次 IndexedDB 寫入。
 * 但切到背景時一定要 flush——否則最後 300ms 內打的字會丟。
 */
export function createDraftWriter(store: Pick<DraftStore, 'save'>, route: string, delay = 300): DraftWriter {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { value: unknown } | undefined

  const write = async () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (!pending) return
    const { value } = pending
    pending = undefined
    await store.save(route, value)
  }

  return {
    update(value) {
      pending = { value }
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => void write(), delay)
    },
    flush: write,
    cancel() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      pending = undefined
    },
  }
}

/**
 * 頁面要被切到背景時呼叫 callback，回傳取消監聽的函式。
 *
 * 只聽 visibilitychange → hidden：這是 iOS 上唯一可靠的「即將離開」訊號。
 * beforeunload 與 pagehide 在 iOS 的 standalone PWA 並不可靠（規格 7.9）。
 */
export function onPageHidden(callback: () => void, doc: Document = document): () => void {
  const listener = () => {
    if (doc.visibilityState === 'hidden') callback()
  }
  doc.addEventListener('visibilitychange', listener)
  return () => doc.removeEventListener('visibilitychange', listener)
}
