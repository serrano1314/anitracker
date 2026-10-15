import type { ReactNode } from 'react'

type AuthFormShellProps = {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthFormShell({ title, description, children, footer }: AuthFormShellProps) {
  return (
    <div className="w-full max-w-md">
      <header className="mb-8 flex flex-col items-center text-center">
        <div className="auth-logo-glow relative">
          <div className="auth-logo-ring flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/60 shadow-lg shadow-indigo-950/50 backdrop-blur-md">
            <img src="/favicon.svg" alt="" className="h-12 w-12 drop-shadow-sm" width={48} height={48} />
          </div>
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-300/90">
          Anime Tracker
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-xs text-sm text-zinc-400">{description}</p> : null}
      </header>

      <div className="auth-panel space-y-5 p-6 sm:p-8">{children}</div>

      {footer ? <div className="mt-6 text-center text-sm text-zinc-400">{footer}</div> : null}
    </div>
  )
}
