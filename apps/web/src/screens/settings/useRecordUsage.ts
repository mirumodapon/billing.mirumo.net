import { useEffect, useState } from 'react'
import { recordUsage, type RecordUsage } from '../../domain/usage'
import { useStores } from '../../stores/StoresProvider'

/** 設定頁開啟時讀一次各類別與付款方式的使用次數；讀到之前是 null，刪除鍵先不出現 */
export function useRecordUsage(): RecordUsage | null {
  const { repo } = useStores()
  const [usage, setUsage] = useState<RecordUsage | null>(null)
  useEffect(() => {
    let cancelled = false
    void recordUsage(repo).then((u) => {
      if (!cancelled) setUsage(u)
    })
    return () => {
      cancelled = true
    }
  }, [repo])
  return usage
}
