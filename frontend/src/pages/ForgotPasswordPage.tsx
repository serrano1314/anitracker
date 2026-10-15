import { Link } from 'react-router-dom'
import { AuthFormShell } from '../components/AuthFormShell'
import { ForgotPasswordUnavailableNotice } from '../components/ForgotPasswordUnavailable'

export function ForgotPasswordPage() {
  return (
    <AuthFormShell
      title="Reset password"
      description="Password reset by email is not available in this version of the app."
      footer={
        <Link to="/login" className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordUnavailableNotice />
    </AuthFormShell>
  )
}
