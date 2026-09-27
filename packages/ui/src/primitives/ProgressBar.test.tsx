import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('exposes its value to assistive tech', () => {
    render(<ProgressBar ratio={0.72} level="normal" ariaLabel="預算已用 72%" />)
    const bar = screen.getByRole('progressbar', { name: '預算已用 72%' })
    expect(bar).toHaveAttribute('aria-valuenow', '72')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-valuetext', '72%')
  })

  // 超支時條子只能畫滿,不能溢出容器
  it('clamps the fill at 100% when over budget', () => {
    render(<ProgressBar ratio={1.8} level="over" ariaLabel="超支" />)
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '100%' })
  })

  it('clamps at 0% rather than drawing a negative width', () => {
    render(<ProgressBar ratio={-0.3} level="normal" ariaLabel="負值" />)
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '0%' })
  })

  // aria-valuenow 必須落在宣告的 min/max 範圍內,否則輔助技術行為未定義
  // （有些會直接夾住)。真正的超支數字改用 aria-valuetext 傳達。
  it('announces the true overage without breaking the declared range', () => {
    render(<ProgressBar ratio={1.8} level="over" ariaLabel="超支" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuetext', '180%')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
  })

  /*
   * task#73：預算沒設定時比例是 0/0 = NaN，而 Math.min(100, Math.max(0, NaN)) 還是
   * NaN，於是 aria-valuenow="NaN"、width: NaN%。沒有數值就該照 ARIA 的「不確定」
   * 進度條處理：不帶 valuenow，也不念出一個不存在的百分比。
   */
  it('reports no value rather than NaN when the ratio is unknown', () => {
    const { container } = render(<ProgressBar ratio={Number.NaN} level="normal" ariaLabel="x" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(bar).not.toHaveAttribute('aria-valuetext')
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '0%' })
    expect(container.innerHTML).not.toContain('NaN')
  })

  // 預算為 0 卻有花費時，core 的 budgetStatus 給 Infinity：條子畫滿沒問題，但不能念「Infinity%」
  it('fills the bar for an infinite ratio without announcing Infinity', () => {
    const { container } = render(<ProgressBar ratio={Number.POSITIVE_INFINITY} level="over" ariaLabel="x" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(bar).not.toHaveAttribute('aria-valuetext')
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '100%' })
    expect(container.innerHTML).not.toContain('Infinity')
  })

  /*
   * task#72：level 原本預設 normal，於是 <ProgressBar ratio={1.8} /> 畫出一條綠色滿格條，
   * 跟剛好用到 100% 一模一樣。門檻（80% 警告）是 core budgetStatus 的業務規則，
   * ui 不該抄一份來推導，所以改成必填：呼叫端傳 budgetStatus().level。
   * 斷言在型別層，由 pnpm typecheck 執行；把 level 改回選填，這行註解就多餘（TS2578）。
   */
  it('requires the caller to say which level the ratio is at', () => {
    // @ts-expect-error level 是必填
    const element = <ProgressBar ratio={1.8} ariaLabel="x" />
    expect(element).toBeTruthy()
  })

  it('marks the level for the stylesheet to colour', () => {
    const { rerender } = render(<ProgressBar ratio={0.5} level="normal" ariaLabel="x" />)
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('data-level', 'normal')
    rerender(<ProgressBar ratio={0.9} level="warning" ariaLabel="x" />)
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('data-level', 'warning')
    rerender(<ProgressBar ratio={1.2} level="over" ariaLabel="x" />)
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('data-level', 'over')
  })

  /*
   * 上面那條只證明屬性標對了,不證明顏色對。CSS 沒有載進 jsdom,所以顏色
   * 這一半只能讀原始碼——證明三個層級各自對到該對的語意 token,不證明
   * 瀏覽器真的畫出那個顏色。
   */
  it('maps every level to its own semantic colour', () => {
    const css = readFileSync(join(import.meta.dirname, 'ProgressBar.css'), 'utf8')
    expect(css).toMatch(/\[data-level='normal'\]\s*{[^}]*background:\s*var\(--bi-accent\)/)
    expect(css).toMatch(/\[data-level='warning'\]\s*{[^}]*background:\s*var\(--bi-warning\)/)
    expect(css).toMatch(/\[data-level='over'\]\s*{[^}]*background:\s*var\(--bi-danger\)/)
  })

  /*
   * 既有的 ratio（0.72、1.8、0.5…）乘 100 後都沒有小數，Math.round 換成
   * Math.floor 一條測試都不會紅。0.725 才分得出來：四捨五入 73、無條件捨去 72。
   * 釘住四捨五入這個選擇——順帶留意 0.999 會被讀成「100%」，條子也畫滿，
   * 但其實還沒超支；如果哪天覺得那樣誤導，改成 floor 時這條會提醒你它是刻意的。
   */
  it('rounds the percentage rather than truncating it', () => {
    render(<ProgressBar ratio={0.725} level="normal" ariaLabel="x" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '73%')
  })
})

// task#76：預算卡片要能用 aria-describedby 把進度條連到說明文字，也要能掛 id
describe('ProgressBar as a DOM element', () => {
  it('forwards its ref', () => {
    const ref = { current: null as HTMLDivElement | null }
    render(<ProgressBar ref={ref} ratio={0.5} level="normal" ariaLabel="x" />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('passes native attributes through', () => {
    render(<ProgressBar ratio={0.5} level="normal" ariaLabel="x" id="p1" data-trip="t" aria-describedby="hint" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('id', 'p1')
    expect(bar).toHaveAttribute('data-trip', 't')
    expect(bar).toHaveAttribute('aria-describedby', 'hint')
  })

  // 數值屬性是元件從 ratio 算出來的；透傳的值蓋過去，輔助技術就會念錯
  it('keeps its own role and values over passed-through ones', () => {
    render(<ProgressBar ratio={0.5} level="normal" ariaLabel="x" role="meter" aria-valuenow={9} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })
})
