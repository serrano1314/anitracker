import { cn } from '../lib/ui'

const SIZE_CLASS = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
} as const

type ProfileAvatarProps = {
  username?: string
  /** Reserved for profile picture upload (not wired yet). */
  avatarUrl?: string | null
  size?: keyof typeof SIZE_CLASS
  className?: string
}

export function userInitials(username: string | undefined): string {
  const trimmed = username?.trim() ?? ''
  if (!trimmed) {
    return '?'
  }
  return trimmed.slice(0, 2).toUpperCase()
}

export function ProfileAvatar({
  username,
  avatarUrl = null,
  size = 'md',
  className,
}: ProfileAvatarProps) {
  const initials = userInitials(username)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-white/10', SIZE_CLASS[size], className)}
      />
    )
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-violet-500/20 font-semibold text-indigo-100 ring-1 ring-white/10',
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden={true}
    >
      {initials}
    </span>
  )
}
