import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDraftWriter, DraftStore, flushAllDrafts, onPageHidden, registerDraftWriter } from './drafts'
import { freshDbName, tickingClock } from './testing/fixtures'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('DraftStore', () => {
  it('keeps one draft per route and gives it back', async () => {
    const store = await DraftStore.open(freshDbName(), tickingClock())
    await store.save('/trip/t1/expense/new', { amount: '1200' })
    await store.save('/trip/t1/expense/new', { amount: '1200+800' })
    expect(await store.load('/trip/t1/expense/new')).toEqual({
      value: { amount: '1200+800' },
      savedAt: '2026-03-15T00:00:01.000Z',
    })
    store.close()
  })

  it('discards a draft', async () => {
    const store = await DraftStore.open(freshDbName())
    await store.save('/r', { a: 1 })
    await store.discard('/r')
    expect(await store.load('/r')).toBeUndefined()
    store.close()
  })
})

describe('createDraftWriter', () => {
  // 不是每按一個鍵就寫：打字時會產生幾十次 IndexedDB 寫入
  it('coalesces rapid edits into one write after the delay', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue(undefined)
    const writer = createDraftWriter({ save }, '/r', 300)
    writer.update({ n: 1 })
    writer.update({ n: 2 })
    writer.update({ n: 3 })
    vi.advanceTimersByTime(299)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('/r', { n: 3 })
  })

  // 切到背景時最後 300ms 內打的字不能丟
  it('writes pending edits immediately on flush', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue(undefined)
    const writer = createDraftWriter({ save }, '/r', 300)
    writer.update({ n: 1 })
    await writer.flush()
    expect(save).toHaveBeenCalledWith('/r', { n: 1 })
    // 已經寫過了，計時器到了也不能再寫一次
    await vi.advanceTimersByTimeAsync(300)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does nothing on flush when there is nothing pending', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    await createDraftWriter({ save }, '/r').flush()
    expect(save).not.toHaveBeenCalled()
  })

  // 儲存成功後會捨棄草稿；還在排隊的那一次若照寫，草稿就被寫回來了
  it('drops pending edits on cancel', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue(undefined)
    const writer = createDraftWriter({ save }, '/r', 300)
    writer.update({ n: 1 })
    writer.cancel()
    await vi.advanceTimersByTimeAsync(300)
    expect(save).not.toHaveBeenCalled()
  })
})

/*
 * 儲存成功 → cancel() 捨棄草稿 → 使用者切到背景 → flush()。若 cancel 只停了計時器
 * 而沒丟掉待寫內容，flush 會把剛捨棄的草稿寫回去，下次打開時已存好的支出旁邊
 * 又冒出一份「已還原未儲存的內容」。上一條只推進計時器，測不到這條路徑。
 */
it('does not resurrect cancelled edits on a later flush', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  const writer = createDraftWriter({ save }, '/r', 300)
  writer.update({ n: 1 })
  writer.cancel()
  await writer.flush()
  expect(save).not.toHaveBeenCalled()
})

describe('onPageHidden', () => {
  function setVisibility(state: 'hidden' | 'visible') {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
    document.dispatchEvent(new Event('visibilitychange'))
  }

  // iOS standalone PWA 上唯一可靠的「即將離開」訊號
  it('fires when the page becomes hidden', () => {
    const callback = vi.fn()
    const stop = onPageHidden(callback)
    setVisibility('hidden')
    expect(callback).toHaveBeenCalledOnce()
    stop()
  })

  it('does not fire when the page becomes visible again', () => {
    const callback = vi.fn()
    const stop = onPageHidden(callback)
    setVisibility('visible')
    expect(callback).not.toHaveBeenCalled()
    stop()
  })

  it('stops listening once unsubscribed', () => {
    const callback = vi.fn()
    onPageHidden(callback)()
    setVisibility('hidden')
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('flushAllDrafts (task#90)', () => {
  it('writes every registered form’s pending draft at once', async () => {
    const saved: string[] = []
    const store = { save: async (route: string) => void saved.push(route) }
    const a = createDraftWriter(store, '/a')
    const b = createDraftWriter(store, '/b')
    const offA = registerDraftWriter(a)
    const offB = registerDraftWriter(b)
    a.update({ x: 1 })
    b.update({ x: 2 })
    await flushAllDrafts()
    expect(saved.sort()).toEqual(['/a', '/b'])
    offA()
    offB()
  })

  it('leaves out forms that have closed', async () => {
    const saved: string[] = []
    const writer = createDraftWriter({ save: async (route: string) => void saved.push(route) }, '/gone')
    registerDraftWriter(writer)()
    writer.update({ x: 1 })
    await flushAllDrafts()
    expect(saved).toEqual([])
    writer.cancel()
  })
})
