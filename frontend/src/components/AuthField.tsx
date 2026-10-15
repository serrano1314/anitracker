import type { InputHTMLAttributes } from 'react'
import { UI, cn } from '../lib/ui'

type AuthFieldProps = {
  label: string
} & InputHTMLAttributes<HTMLInputElement>

export function AuthField({ label, className, ...inputProps }: AuthFieldProps) {
  return (
    <label className="ui-field block">
      <span className="ui-field-label">{label}</span>
      <input className={cn(UI.input, className)} {...inputProps} />
    </label>
  )
}
