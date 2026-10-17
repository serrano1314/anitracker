import { useState, type InputHTMLAttributes } from 'react'
import { UI, cn } from '../lib/ui'

type AuthFieldProps = {
  label: string
  showPasswordToggle?: boolean
} & InputHTMLAttributes<HTMLInputElement>

export function AuthField({ label, className, showPasswordToggle = false, type, ...inputProps }: AuthFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const canTogglePassword = showPasswordToggle && type === 'password'

  return (
    <label className="ui-field block">
      <span className="ui-field-label">{label}</span>
      <span className="relative block">
        <input
          className={cn(UI.input, canTogglePassword && 'pr-12', className)}
          type={canTogglePassword && isPasswordVisible ? 'text' : type}
          {...inputProps}
        />
        {canTogglePassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-3 flex items-center text-indigo-300/55 hover:text-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={isPasswordVisible}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
              <path d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6-9.75-6-9.75-6Z" />
              <circle cx="12" cy="12" r="2.5" />
              {isPasswordVisible ? null : <path d="m3 3 18 18" />}
            </svg>
          </button>
        ) : null}
      </span>
    </label>
  )
}
