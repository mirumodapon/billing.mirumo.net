import { describe, expect, it } from 'vitest'
import { Donut } from '../chart/Donut'
import { AvatarToggleGroup } from '../input/AvatarToggleGroup'
import { ChipGroup } from '../input/ChipGroup'
import { Avatar } from '../primitives/Avatar'
import { Chip } from '../primitives/Chip'

/*
 * task#69：colorKey 會被代入成 var(--bi-${colorKey})。原本型別是裸 string，
 * 傳 'primary' 會算出一個不存在的 custom property，背景靜靜消失，編譯期與
 * 執行期都沒有訊號。
 *
 * 這個檔案的斷言在型別層：每一行 @ts-expect-error 都要求底下那行「編譯失敗」。
 * 有人把 colorKey 放寬回 string，那行就變成合法，tsc 會回報 TS2578（多餘的
 * 註解），`pnpm typecheck` 因此變紅。vitest 不做型別檢查，這裡的 it 只是讓
 * 檔案有個測試可跑；真正的守門員是 typecheck。
 */
describe('colorKey', () => {
  it('accepts only the twelve accent slots, in every component that paints one', () => {
    const noop = () => {}
    const elements = [
      <Chip label="x" colorKey="accent3" />,
      // @ts-expect-error 不是 accent 槽位
      <Chip label="x" colorKey="primary" />,
      <Avatar name="x" colorKey="accent12" />,
      // @ts-expect-error 不是 accent 槽位
      <Avatar name="x" colorKey="accent13" />,
      // @ts-expect-error 不是 accent 槽位
      <ChipGroup ariaLabel="x" value="a" onChange={noop} options={[{ value: 'a', label: 'a', colorKey: 'success' }]} />,
      // @ts-expect-error 不是 accent 槽位
      <AvatarToggleGroup ariaLabel="x" selected={[]} onChange={noop} items={[{ value: 'a', name: 'a', colorKey: 'accent' }]} />,
      <Donut
        ariaLabel="x"
        formatValue={String}
        emptyLabel="x"
        totalLabel="x"
        // @ts-expect-error 不是 accent 槽位
        segments={[{ key: 'a', label: 'a', value: 1, colorKey: 'red' }]}
      />,
    ]
    expect(elements).toHaveLength(7)
  })
})
