import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { User } from '../types/auth'
import { ProfileAvatar } from './ProfileAvatar'
import { UI, cn } from '../lib/ui'

type ProfileModalProps = {
  open: boolean
  user: User
  onClose: () => void
}

export function ProfileModal({ open, user, onClose }: ProfileModalProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ui-modal-panel w-full max-w-md space-y-6 p-6 sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-zinc-50">
            Profile
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
            aria-label="Close profile"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 fill-current">
              <path d="M5.3 4.3a1 1 0 0 0-1.4 1.4L8.6 10 3.9 14.7a1 1 0 1 0 1.4 1.4L10 11.4l4.7 4.7a1 1 0 0 0 1.4-1.4L11.4 10l4.7-4.7a1 1 0 0 0-1.4-1.4L10 8.6 5.3 4.3z" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:text-left">
          <ProfileAvatar username={user.username} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-medium text-zinc-50">{user.username}</p>
            <p className="truncate text-sm text-zinc-400">{user.email}</p>
          </div>
        </div>

        <div className="space-y-4 border-t border-white/10 pt-5">
          <ProfileSection
            title="Profile picture"
            description="Upload a custom avatar. This will be available in a future update."
          >
            <button type="button" disabled className={cn(UI.btn, UI.btnSecondary, 'w-full sm:w-auto')}>
              Change picture
            </button>
          </ProfileSection>

          <ProfileSection
            title="Username"
            description="Rename your account display name. Coming soon."
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                readOnly
                disabled
                value={user.username}
                className={cn(UI.input, 'sm:flex-1')}
                aria-describedby="profile-username-hint"
              />
              <button type="button" disabled className={cn(UI.btn, UI.btnSecondary, 'shrink-0')}>
                Change username
              </button>
            </div>
            <p id="profile-username-hint" className="text-xs text-zinc-500">
              Editing will be enabled when account settings ship.
            </p>
          </ProfileSection>
        </div>

        <div className="flex justify-end border-t border-white/10 pt-4">
          <button type="button" onClick={onClose} className={cn(UI.btn, UI.btnPrimary)}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

type ProfileSectionProps = {
  title: string
  description: string
  children: ReactNode
}

function ProfileSection({ title, description, children }: ProfileSectionProps) {
  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
      {children}
    </section>
  )
}
