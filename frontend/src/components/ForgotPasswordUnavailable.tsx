import type { ReactNode } from 'react'
import { useDialog } from './dialogContext'

export const FORGOT_PASSWORD_UNAVAILABLE_TITLE = 'Password reset not available'
export const FORGOT_PASSWORD_UNAVAILABLE_MESSAGE =
  'Email password reset is not enabled yet. While signed in, change your password under Settings → Account security.'

type ForgotPasswordUnavailableTriggerProps = {
  children?: ReactNode
  className?: string
}

export function ForgotPasswordUnavailableTrigger({
  children = 'Forgot password?',
  className = 'font-medium text-indigo-300 hover:text-indigo-200 hover:underline',
}: ForgotPasswordUnavailableTriggerProps) {
  const dialog = useDialog()

  return (
    <button
      type="button"
      className={className}
      title={FORGOT_PASSWORD_UNAVAILABLE_MESSAGE}
      onClick={() => {
        void dialog.success({
          title: FORGOT_PASSWORD_UNAVAILABLE_TITLE,
          message: FORGOT_PASSWORD_UNAVAILABLE_MESSAGE,
        })
      }}
    >
      {children}
    </button>
  )
}

export function ForgotPasswordUnavailableNotice() {
  return (
    <p className="text-sm text-zinc-300" title={FORGOT_PASSWORD_UNAVAILABLE_MESSAGE}>
      {FORGOT_PASSWORD_UNAVAILABLE_MESSAGE}
    </p>
  )
}
