import type { ButtonHTMLAttributes, Ref } from 'react'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** 處理中：視覺變淡、擋住點擊、對輔助技術宣告 aria-busy */
  busy?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary',
  busy = false,
  disabled,
  type = 'button',
  onClick,
  children,
  ref,
  ...rest
}: ButtonProps) {
  // disabled 靠原生屬性擋，busy 只是視覺與語意狀態，所以點擊要自己擋
  const inert = disabled === true || busy
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled}
      aria-busy={busy || undefined}
      data-variant={variant}
      className="bi-button"
      onClick={inert ? undefined : onClick}
    >
      {children}
    </button>
  )
}
