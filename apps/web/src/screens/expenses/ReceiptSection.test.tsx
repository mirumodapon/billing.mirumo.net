import type { AttachmentMeta } from '@billing/core'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compressImage } from '../../data/compressImage'
import { clearSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { t, tPlural } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

vi.mock('../../data/compressImage', () => ({ compressImage: vi.fn() }))
const mockedCompress = vi.mocked(compressImage)

beforeEach(() => {
  clearSession()
  mockedCompress.mockReset()
  // jsdom 沒有 object URL
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())

async function open(attachments: AttachmentMeta[] = []) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1' }))
  await stores.repo.saveExpense(makeExpense({ id: 'e1', tripId: 't1', attachments }))
  const app = await renderApp('/trip/t1/expense/e1', stores)
  const header = () => screen.getByRole('button', { name: new RegExp(`^${t('receipt.title')}`) })
  await app.user.click(header())
  return { ...app, header, panel: () => within(screen.getByTestId('section-receipt-panel')) }
}

const pick = (file: File) => fireEvent.change(screen.getByTestId('receipt-input'), { target: { files: [file] } })

describe('ReceiptSection', () => {
  // 規格 7.3：壓縮後才存，原圖不落地
  it('stores the compressed photo, not the original, and attaches it', async () => {
    const compressed = new Blob([new Uint8Array(1200)], { type: 'image/webp' })
    mockedCompress.mockResolvedValue({ blob: compressed, width: 1600, height: 1200 })
    const { header, stores, panel } = await open()
    const original = new File([new Uint8Array(5000)], 'receipt.jpg', { type: 'image/jpeg' })
    pick(original)
    await waitFor(() => expect(header()).toHaveTextContent(tPlural('receipt.count', { count: 1 })))
    expect(mockedCompress).toHaveBeenCalledWith(original)
    expect(await stores.blobs.usage()).toEqual({ bytes: 1200, count: 1 })
    expect(await panel().findByRole('img', { name: t('receipt.photo', { n: 1 }) })).toHaveAttribute('src', 'blob:preview')
  })

  it('saves the photo’s details with the expense', async () => {
    mockedCompress.mockResolvedValue({ blob: new Blob([new Uint8Array(900)], { type: 'image/webp' }), width: 1200, height: 1600 })
    const { user, header, stores } = await open()
    pick(new File(['x'], 'r.jpg', { type: 'image/jpeg' }))
    await waitFor(() => expect(header()).toHaveTextContent(tPlural('receipt.count', { count: 1 })))
    await user.click(screen.getByRole('button', { name: t('form.save') }))
    await waitFor(async () => expect((await stores.repo.listExpenses('t1'))[0]?.attachments).toEqual([
      { id: expect.any(String), mimeType: 'image/webp', byteSize: 900, width: 1200, height: 1600 },
    ]))
  })

  // Plan 7 E7：匯入不含照片的備份後，佔位而不是破圖
  it('shows a placeholder for a photo that is not in this backup', async () => {
    const { panel } = await open([{ id: 'gone', mimeType: 'image/webp', byteSize: 1, width: 1, height: 1 }])
    expect(await panel().findByRole('img', { name: t('receipt.missing') })).toBeInTheDocument()
  })

  // 不刪 Blob：使用者可能不存檔就離開，舊版本仍然引用它
  it('removes a photo from the expense without deleting the file', async () => {
    const stores = await makeStores()
    const id = await stores.blobs.put(new Blob(['x']))
    await stores.repo.saveTrip(makeTrip({ id: 't1' }))
    await stores.repo.saveExpense(makeExpense({ id: 'e1', tripId: 't1', attachments: [{ id, mimeType: 'image/webp', byteSize: 1, width: 1, height: 1 }] }))
    const { user } = await renderApp('/trip/t1/expense/e1', stores)
    const header = () => screen.getByRole('button', { name: new RegExp(`^${t('receipt.title')}`) })
    await user.click(header())
    const spy = vi.spyOn(stores.blobs, 'delete')
    await user.click(within(screen.getByTestId('section-receipt-panel')).getByRole('button', { name: t('receipt.remove') }))
    expect(header()).toHaveTextContent(t('receipt.none'))
    expect(spy).not.toHaveBeenCalled()
    expect(await stores.blobs.get(id)).toBeDefined()
  })

  it('says so when a photo cannot be read', async () => {
    mockedCompress.mockRejectedValue(new Error('not an image'))
    const { header } = await open()
    pick(new File(['x'], 'r.heic', { type: 'image/heic' }))
    expect(await screen.findByText(t('receipt.failed'))).toBeInTheDocument()
    expect(header()).toHaveTextContent(t('receipt.none'))
  })
})
