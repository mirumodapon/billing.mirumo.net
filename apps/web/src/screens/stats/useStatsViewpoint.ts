import type { Scope, Trip } from '@billing/core'
import { useState } from 'react'
import { readSession, writeSession } from '../../data/session'

/** 統計的視角：全團，或某一位成員該負擔的部分 */
export type StatsViewpoint = { scope: 'group' } | { scope: 'self'; memberId: string }

/**
 * 統計從誰的角度看，記住上次的選擇（規格 4.5、13.5 statsScope，加上 statsMember）。
 * 沒記錄時是全團：與支出列表頂部的「已花」是同一個數字（Plan 9 T1）。
 * 記住的成員已經不在這趟旅程（或換了旅程）時退回我自己。
 */
export function useStatsViewpoint(trip: Trip): [StatsViewpoint, (next: StatsViewpoint) => void] {
  const [saved, setSaved] = useState(() => {
    const session = readSession()
    return { scope: (session?.statsScope ?? 'group') as Scope, memberId: session?.statsMember }
  })
  const memberId = saved.memberId && trip.members.some((m) => m.id === saved.memberId) ? saved.memberId : trip.selfMemberId
  const viewpoint: StatsViewpoint = saved.scope === 'group' ? { scope: 'group' } : { scope: 'self', memberId }

  const change = (next: StatsViewpoint) => {
    const memberOf = next.scope === 'self' ? next.memberId : undefined
    setSaved({ scope: next.scope, memberId: memberOf ?? saved.memberId })
    // 規格 7.9：切換立即寫 session
    const session = { ...(readSession() ?? { route: location.hash.replace(/^#/, '') || '/' }), statsScope: next.scope }
    if (memberOf) session.statsMember = memberOf
    writeSession(session)
  }
  return [viewpoint, change]
}

/** 統計各區塊的收折（Plan 9 T4）：預設全部展開，收起的記在 session，重開 app 還是收著 */
export function useCollapsedStats(): [(key: string) => boolean, (key: string) => void] {
  const [collapsed, setCollapsed] = useState<string[]>(() => readSession()?.collapsedStats ?? [])
  const toggle = (key: string) => {
    const next = collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key]
    setCollapsed(next)
    writeSession({ ...(readSession() ?? { route: location.hash.replace(/^#/, '') || '/' }), collapsedStats: next })
  }
  return [(key) => !collapsed.includes(key), toggle]
}
