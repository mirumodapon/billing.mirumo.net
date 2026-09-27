export const ERROR_LOG_KEY = 'bi-errors'
export const ERROR_LOG_LIMIT = 50

export interface ErrorEntry {
  at: string
  message: string
  stack?: string
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/**
 * 本機的錯誤記錄環狀緩衝區（規格 7.7）。沒有後端就沒有回報管道，但使用者回報
 * 問題時至少能從設定頁複製 log 貼出來。
 *
 * 存 localStorage 而不是 IndexedDB：出事的可能正是 IndexedDB，而且 app 崩潰
 * 當下沒有機會等非同步寫入完成。
 *
 * 這個模組自己絕不能拋錯——記錄錯誤的程式碼出錯，會把原本的錯誤蓋掉。
 */
export class ErrorLog {
  constructor(
    private readonly store: Storage | undefined = storage(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  list(): ErrorEntry[] {
    try {
      const raw = this.store?.getItem(ERROR_LOG_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? (parsed as ErrorEntry[]) : []
    } catch {
      return []
    }
  }

  record(error: unknown): void {
    try {
      const entry: ErrorEntry =
        error instanceof Error
          ? { at: this.now(), message: `${error.name}: ${error.message}`, stack: error.stack }
          : { at: this.now(), message: String(error) }
      // 只留最新的 50 筆，舊的從前面丟掉
      const next = [...this.list(), entry].slice(-ERROR_LOG_LIMIT)
      this.store?.setItem(ERROR_LOG_KEY, JSON.stringify(next))
    } catch {
      // 刻意吞掉：配額滿了或無痕模式時，寧可少一筆記錄也不要再拋一次
    }
  }

  clear(): void {
    try {
      this.store?.removeItem(ERROR_LOG_KEY)
    } catch {
      // 刻意吞掉
    }
  }
}

/** 攔下全域的未捕捉錯誤與未處理的 Promise rejection，回傳解除監聽的函式 */
export function installGlobalErrorLogging(log: ErrorLog, target: Window = window): () => void {
  const onError = (event: ErrorEvent) => log.record(event.error ?? event.message)
  const onRejection = (event: PromiseRejectionEvent) => log.record(event.reason)
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
