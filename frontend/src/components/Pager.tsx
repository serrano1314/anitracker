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
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-sm text-zinc-400">Page {page}</span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onPage(page + 1)}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  )
}
