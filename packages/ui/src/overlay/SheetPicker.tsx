import { IconCheck } from '@tabler/icons-react'
import { Icon } from '../icons/Icon'
import { Sheet } from './Sheet'

export interface PickerOption {
  value: string
  label: string
}

export interface SheetPickerProps {
  open: boolean
  title: string
  options: readonly PickerOption[]
  /** 目前選中的 value */
  value: string
  onSelect: (value: string) => void
  onClose: () => void
}

export function SheetPicker({ open, title, options, value, onSelect, onClose }: SheetPickerProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div role="radiogroup" aria-label={title} className="bi-picker">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className="bi-picker__option"
            onClick={() => {
              onSelect(option.value)
              onClose()
            }}
          >
            <span>{option.label}</span>
            {/*
             * 勾選圖示是純裝飾，不給 label：aria-checked 已經把選中狀態
             * 告訴輔助科技了，再念一次「已勾選」只是重複
             */}
            {option.value === value ? <Icon glyph={IconCheck} /> : null}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
