import type { Scope } from '@billing/core'
import { useState } from 'react'
import { readSession, writeSession } from '../../data/session'

/**
 * 統計的口徑，記住上次的選擇（規格 4.5、13.5 statsScope）。
 * 沒記錄時是全團：與支出列表頂部的「已花」是同一個數字（Plan 9 T1）。
 */
export function useStatsScope(): [Scope, (scope: Scope) => void] {
  const [scope, setScope] = useState<Scope>(() => readSession()?.statsScope ?? 'group')
  const change = (next: Scope) => {
    setScope(next)
    // 規格 7.9：切換立即寫 session
    writeSession({ ...(readSession() ?? { route: location.hash.replace(/^#/, '') || '/' }), statsScope: next })
  }
  return [scope, change]
}
