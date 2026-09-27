import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ColorSwatches } from './ColorSwatches'

const keys = Array.from({ length: 12 }, (_, i) => `accent${i + 1}`)
const labelFor = (key: string) => `顏色 ${key.replace('accent', '')}`

describe('ColorSwatches', () => {
  it('is a radiogroup with one radio per slot', () => {
    render(<ColorSwatches keys={keys} value="accent3" onChange={vi.fn()} label="顏色" labelFor={labelFor} />)
    expect(screen.getByRole('radiogroup', { name: '顏色' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(12)
  })

  it('paints each swatch from its semantic slot', () => {
    render(<ColorSwatches keys={keys} value="accent3" onChange={vi.fn()} label="顏色" labelFor={labelFor} />)
    expect(screen.getByTestId('swatch-accent7')).toHaveStyle({ background: 'var(--bi-accent7)' })
  })

  it('names each swatch through labelFor and checks the current one', () => {
    render(<ColorSwatches keys={keys} value="accent3" onChange={vi.fn()} label="顏色" labelFor={labelFor} />)
    expect(screen.getByRole('radio', { name: '顏色 3' })).toBeChecked()
  })

  it('reports the slot that was pressed', async () => {
    const onChange = vi.fn()
    render(<ColorSwatches keys={keys} value="accent3" onChange={onChange} label="顏色" labelFor={labelFor} />)
    await userEvent.click(screen.getByRole('radio', { name: '顏色 9' }))
    expect(onChange).toHaveBeenCalledWith('accent9')
  })

  it('moves selection and focus with the arrow keys', async () => {
    function Controlled() {
      const [v, setV] = useState('accent1')
      return <ColorSwatches keys={keys} value={v} onChange={setV} label="顏色" labelFor={labelFor} />
    }
    render(<Controlled />)
    screen.getByRole('radio', { name: '顏色 1' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '顏色 2' })).toHaveFocus()
  })

  /*
   * 選中用畫在色塊外的環，對比對象是背景；在色塊上疊勾的話，勾要同時與十二種
   * 底色都有對比，而 --bi-accent-fg 在淺色主題做不到（task#71）。
   */
  it('marks selection with a ring outside the swatch, not a mark on it', () => {
    const css = readFileSync(join(import.meta.dirname, 'ColorSwatches.css'), 'utf8')
    expect(css).toMatch(/\[aria-checked='true'\][^{]*{[^}]*box-shadow/)
    expect(css).not.toMatch(/--bi-accent-fg/)
  })
})
