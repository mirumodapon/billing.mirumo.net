import type { ReactNode } from 'react'

export type SafeAreaEdge = 'top' | 'bottom' | 'left' | 'right'

export interface SafeAreaProps {
  /** 要留出系統安全區的邊。只列真正貼邊的那幾邊，全開會讓內容平白內縮 */
  edges: readonly SafeAreaEdge[]
  children: ReactNode
  'data-testid'?: string
}

export function SafeArea({ edges, children, ...rest }: SafeAreaProps) {
  return (
    <div
      className="bi-safe"
      data-top={edges.includes('top') || undefined}
      data-bottom={edges.includes('bottom') || undefined}
      data-left={edges.includes('left') || undefined}
      data-right={edges.includes('right') || undefined}
      {...rest}
    >
      {children}
    </div>
  )
}
