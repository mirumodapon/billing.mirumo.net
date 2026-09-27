import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect } from 'vitest'
import { App } from '../app/App'
import { createSettingsStore } from '../stores/settingsStore'
import { createTripStore } from '../stores/tripStore'
import type { Stores } from '../stores/StoresProvider'
import { createUiStore } from '../stores/uiStore'
import { IdbTripRepository } from '../data/tripRepository'
import { freshDbName, tickingClock } from '../data/testing/fixtures'

/** 每次一個新資料庫，時間由 tickingClock 提供，測試之間互不干擾 */
export async function openTestRepo(): Promise<IdbTripRepository> {
  return IdbTripRepository.open(freshDbName(), { now: tickingClock() })
}

/** 測試用的一整組 store，接在一個全新的資料庫上 */
export async function makeStores(): Promise<Stores> {
  const repo = await openTestRepo()
  const ui = createUiStore()
  const settings = createSettingsStore({ repo, ui })
  return { repo, ui, settings, trips: createTripStore({ repo, ui }) }
}

/**
 * 把整個 app 掛在指定路由上，等冷啟動（Boot）跑完才回傳。
 * 傳入 stores 可以沿用同一個資料庫，模擬「關掉 app 再打開」。
 */
export async function renderApp(route: string, stores?: Stores) {
  const s = stores ?? (await makeStores())
  history.replaceState(null, '', `#${route}`)
  const user = userEvent.setup()
  const result = await mountApp(s)
  await waitFor(() => expect(screen.queryByTestId('boot')).not.toBeInTheDocument())
  return { ...result, stores: s, user }
}

/** 目前的 hash 路由，不含 # */
export const currentRoute = () => location.hash.replace(/^#/, '')

/**
 * 掛上 App。必須包在 async act 裡：App 用 use() 等 store 的 promise，
 * 在 act 之外 resolve 的話，測試環境裡的 React 不會重新渲染，畫面永遠停在骨架。
 */
export async function mountApp(stores: Stores) {
  let result!: ReturnType<typeof render>
  await act(async () => {
    result = render(<App stores={Promise.resolve(stores)} />)
  })
  return result
}
