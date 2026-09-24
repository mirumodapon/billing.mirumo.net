import { CORE_VERSION } from '@billing/core'
import { UI_VERSION } from '@billing/ui'

export function App() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Travel Split</h1>
      <p className="text-sm" style={{ color: 'var(--bi-text-muted)' }}>
        core {CORE_VERSION} · ui {UI_VERSION}
      </p>
    </main>
  )
}
