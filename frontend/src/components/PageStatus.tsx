import type { ReactNode } from 'react'
import { UI, cn } from '../lib/ui'

type LoadingProps = {
  label?: string
}

export function LoadingIndicator({ label = 'Loading…' }: LoadingProps) {
  return (
    <div className="flex items-center gap-3 text-zinc-400" role="status" aria-live="polite">
      <span
        className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400"
        aria-hidden="true"
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}

type ErrorPanelProps = {
  message: string
  onRetry?: () => void
}

export function ErrorPanel({ message, onRetry }: ErrorPanelProps) {
  return (
    <div className="ui-card space-y-3 border-red-500/30 bg-red-500/5">
      <p className="text-sm text-red-300">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(UI.btn, UI.btnSecondary, 'py-2')}
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}

type EmptyStateProps = {
  children: ReactNode
}

export function EmptyState({ children }: EmptyStateProps) {
  return <p className="ui-card text-sm text-zinc-400">{children}</p>
}
