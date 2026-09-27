import { describe, expect, it, vi } from 'vitest'
import { shareSettlement } from './shareSettlement'

describe('shareSettlement', () => {
  it('uses the share sheet when there is one', async () => {
    const share = vi.fn(async () => {})
    const writeText = vi.fn(async () => {})
    expect(await shareSettlement('東京 結算', '內容', { share, clipboard: { writeText } })).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: '東京 結算', text: '內容' })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies the text when there is no share sheet', async () => {
    const writeText = vi.fn(async () => {})
    expect(await shareSettlement('t', '內容', { clipboard: { writeText } })).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('內容')
  })

  // 按了取消就是取消：不能又跳出「已複製」
  it('does nothing more when the user cancels the share sheet', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('cancelled', 'AbortError')
    })
    const writeText = vi.fn(async () => {})
    expect(await shareSettlement('t', '內容', { share, clipboard: { writeText } })).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to copying when sharing fails for another reason', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('no', 'NotAllowedError')
    })
    const writeText = vi.fn(async () => {})
    expect(await shareSettlement('t', '內容', { share, clipboard: { writeText } })).toBe('copied')
  })

  it('reports failure when neither works', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied')
    })
    expect(await shareSettlement('t', '內容', { clipboard: { writeText } })).toBe('failed')
    expect(await shareSettlement('t', '內容', {})).toBe('failed')
  })
})
