import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IdbBlobStore } from './blobStore'
import { clearAllData } from './clearAll'
import { DraftStore } from './drafts'
import { freshDbName, makeTrip } from './testing/fixtures'
import { IdbTripRepository } from './tripRepository'

describe('clearAllData (task#133)', () => {
  it('clears photos, half-filled forms and browser storage too, while their stores stay open', async () => {
    const name = freshDbName()
    const [repo, drafts, blobs] = await Promise.all([IdbTripRepository.open(name), DraftStore.open(name), IdbBlobStore.open(name)])
    await repo.saveTrip(makeTrip({ id: 't1' }))
    const photo = await blobs.put(new Blob(['x']))
    await drafts.save('/trip/t1/expense/new', { amount: 1 })
    localStorage.setItem('some-key', '1')
    sessionStorage.setItem('other-key', '1')
    await clearAllData(repo)
    expect(await repo.listTrips()).toEqual([])
    expect(await blobs.get(photo)).toBeUndefined()
    expect(await drafts.load('/trip/t1/expense/new')).toBeUndefined()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    for (const s of [repo, drafts, blobs]) s.close()
  })
})
