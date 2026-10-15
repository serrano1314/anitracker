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
    <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <p className="text-sm text-red-400">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}

import type { ReactNode } from 'react'

type EmptyStateProps = {
  children: ReactNode
}

export function EmptyState({ children }: EmptyStateProps) {
  return <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">{children}</p>
}
