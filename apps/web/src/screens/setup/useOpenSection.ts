import { useState } from 'react'
import { readSession, writeSession } from '../../data/session'
import type { SessionState } from '../../data/types'

/**
 * 一次只展開一個區塊，記在 session 裡（規格 13.5 openAccordion），
 * 重開 app 時停在同一個區塊。
 */
export function useOpenSection() {
  const [open, setOpen] = useState(() => readSession()?.openAccordion)
  const toggle = (key: string) => {
    const next = open === key ? undefined : key
    setOpen(next)
    const session: SessionState = { ...(readSession() ?? { route: location.hash.replace(/^#/, '') || '/' }) }
    if (next) session.openAccordion = next
    else delete session.openAccordion
    writeSession(session)
  }
  return { open, toggle }
}
