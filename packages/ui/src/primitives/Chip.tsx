export interface ChipProps {
  label: string
  selected?: boolean
  disabled?: boolean
  /** 有值時渲染成可點的 button；沒有時是純標籤 */
  onSelect?: () => void
  /** accent 槽位名稱，如 'accent3'。不給則不顯示圓點 */
  colorKey?: string
}

export function Chip({ label, selected = false, disabled = false, onSelect, colorKey }: ChipProps) {
  const dot = colorKey ? (
    <span
      data-testid="chip-dot"
      className="bi-chip__dot"
      // semantic 層的身分色名稱與 colorKey 逐字對應，所以可以直接代入。
      // 不要改成 --bi-p-*：那會繞過兩層架構，而 layering.test.ts 會擋下來
      style={{ background: `var(--bi-${colorKey})` }}
    />
  ) : null

  if (!onSelect) {
    return (
      <span className="bi-chip" data-selected={selected || undefined}>
        {dot}
        {label}
      </span>
    )
  }

  return (
    <button
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
