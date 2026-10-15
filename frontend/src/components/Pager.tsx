import { UI, cn } from '../lib/ui'

type PagerProps = {
  page: number
  hasNext: boolean
  onPage: (page: number) => void
}

export function Pager({ page, hasNext, onPage }: PagerProps) {
  if (page <= 1 && !hasNext) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={cn(UI.btn, UI.btnSecondary, 'py-2')}
      >
        Previous
      </button>
      <span className="text-sm text-zinc-400">Page {page}</span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onPage(page + 1)}
        className={cn(UI.btn, UI.btnSecondary, 'py-2')}
      >
        Next
      </button>
    </div>
  )
}
