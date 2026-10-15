type PageHeaderProps = {
  title: string
  description?: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{title}</h1>
      {description ? <p className="text-sm text-zinc-400">{description}</p> : null}
    </header>
  )
}
