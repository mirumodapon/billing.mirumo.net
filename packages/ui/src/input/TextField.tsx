import { useId } from 'react'

export interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  /** 有值時顯示在欄位下方，並讓欄位對輔助科技宣告無效 */
  error?: string
  autoFocus?: boolean
  /** 離開欄位時。設定頁在這時才存檔，而不是每按一個鍵存一次 */
  onBlur?: () => void
  /**
   * 標籤只給輔助技術，畫面上不顯示。用在一列列同類的欄位（清單裡每一項的名稱），
   * 那時可見的標籤只是重複、還會讓欄位與旁邊沒有標籤的列對不齊
   */
  hideLabel?: boolean
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  error,
  autoFocus,
  onBlur,
  hideLabel = false,
}: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="bi-field" data-invalid={error ? true : undefined}>
      <label className={hideLabel ? 'bi-visually-hidden' : 'bi-field__label'} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="bi-field__input"
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        // 規格 5.6：全域關掉文字選取，輸入框要開回來
        data-selectable
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {error ? (
        <p id={errorId} className="bi-field__error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
