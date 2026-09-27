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
}: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="bi-field" data-invalid={error ? true : undefined}>
      <label className="bi-field__label" htmlFor={id}>
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
