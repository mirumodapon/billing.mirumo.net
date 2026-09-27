import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IdbBlobStore } from './blobStore'
import { freshDbName } from './testing/fixtures'

let store: IdbBlobStore

beforeEach(async () => {
  store = await IdbBlobStore.open(freshDbName())
})
afterEach(() => store.close())

const bytesOf = async (blob: Blob) => Array.from(new Uint8Array(await blob.arrayBuffer()))

describe('IdbBlobStore', () => {
  /*
   * 逐位元組比對，不只比大小。jsdom 下的 fake-indexeddb 存不了 Blob——存進去
   * 讀回來是一個空物件——所以實作存的是 ArrayBuffer。只比 size 的話，
   * 一個「存了東西但內容錯亂」的實作也會通過。
   */
  it('gives back exactly the bytes and type that went in', async () => {
    const id = await store.put(new Blob([new Uint8Array([0, 1, 2, 250, 255])], { type: 'image/webp' }))
    const back = await store.get(id)
    expect(back?.type).toBe('image/webp')
    expect(await bytesOf(back!)).toEqual([0, 1, 2, 250, 255])
  })

  it('gives each photo its own id', async () => {
    const a = await store.put(new Blob(['a']))
    const b = await store.put(new Blob(['b']))
    expect(a).not.toBe(b)
  })

  it('returns undefined for an unknown id', async () => {
    expect(await store.get('nope')).toBeUndefined()
  })

  it('deletes a photo', async () => {
    const id = await store.put(new Blob(['x']))
    await store.delete(id)
    expect(await store.get(id)).toBeUndefined()
  })

  // 匯入 zip 時照原 id 寫回，支出裡的 AttachmentMeta 才找得到它
  it('restores a photo under the id it had before', async () => {
    await store.restore('original-id', new Blob(['receipt'], { type: 'image/webp' }))
    expect(await (await store.get('original-id'))!.text()).toBe('receipt')
  })

  it('reports how many photos and bytes it holds', async () => {
    await store.put(new Blob([new Uint8Array(100)]))
    await store.put(new Blob([new Uint8Array(250)]))
    expect(await store.usage()).toEqual({ bytes: 350, count: 2 })
  })
})
