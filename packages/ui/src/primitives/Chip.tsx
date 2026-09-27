import type { HTMLAttributes, Ref } from 'react'
import type { AccentSlot } from '../theme/accentOrder'

// onSelect 在 DOM 上是「選取文字」事件，這裡另有意思，所以從原生屬性裡拿掉
export interface ChipProps extends Omit<HTMLAttributes<HTMLElement>, 'className' | 'children' | 'onSelect'> {
  label: string
  selected?: boolean
  disabled?: boolean
  /** 有值時渲染成可點的 button；沒有時是純標籤 */
  onSelect?: () => void
  /** accent 槽位名稱，如 'accent3'。不給則不顯示圓點 */
  colorKey?: AccentSlot
  /** 純標籤時指向 span，可點時指向 button */
  ref?: Ref<HTMLElement>
}

export function Chip({ label, selected = false, disabled = false, onSelect, colorKey, ref, ...rest }: ChipProps) {
  const dot = colorKey ? (
    <span
      data-testid="chip-dot"
      className="bi-chip__dot"
      // semantic 層的身分色名稱與 colorKey 逐字對應，所以可以直接代入。
      // 不要改成 --bi-p-*：那會繞過兩層架構，而 layering.test.ts 會擋下來
      style={{ background: `var(--bi-${colorKey})` }}
    />
  ) : null

  // 兩種形態都是透傳的屬性先展開、元件自己的放後面：選取與停用的語意不能被蓋掉
  if (!onSelect) {
    return (
      <span {...rest} ref={ref} className="bi-chip" data-selected={selected || undefined}>
        {dot}
        {label}
      </span>
    )
  }

  return (
    <button
      {...rest}
      // RefObject 的 current 在型別上是協變的，HTMLElement 不能直接當 HTMLButtonElement 用；
      // 執行期 React 只會把 button 本身寫進去，所以這個轉型是安全的
      ref={ref as Ref<HTMLButtonElement>}
      type="button"
      className="bi-chip"
      data-selected={selected || undefined}
      aria-pressed={selected}
      disabled={disabled}
      // 擋住點擊的是上面那個原生 disabled 屬性，不是這個三元式——拿掉它
      // 行為完全不變（實測過）。留著只是與 Button 的形狀一致。
      // 注意 Button 的 busy 不一樣：那不是原生屬性，它的守衛是真的承重的。
      // 日後做非原生的停用狀態時，別以為照抄這一行就會擋住。
      onClick={disabled ? undefined : onSelect}
    >
      {dot}
      {label}
    </button>
  )
}
