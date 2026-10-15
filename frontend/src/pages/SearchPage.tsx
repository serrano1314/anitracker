import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchAnime } from '../api/anime'
import { ApiError } from '../api/client'
import { addToLibrary } from '../api/library'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorPanel, LoadingIndicator } from '../components/PageStatus'
import { Pager } from '../components/Pager'
import { displayTitle, metaLine } from '../lib/display'
import { episodeCountLabel } from '../lib/episodes'
import { backFromSearch } from '../lib/navigation'
import { INPUT_PLACEHOLDERS } from '../lib/placeholders'
import { Select } from '../components/Select'
import { libraryStatusSelectOptions } from '../lib/selectOptions'
import { UI, cn } from '../lib/ui'
import type { LibraryStatus } from '../types/library'

function parsePage(value: string | null): number {
  const page = Number(value)
  if (!Number.isInteger(page) || page < 1) {
    return 1
  }
  return page
}

export function SearchPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const query = params.get('q')?.trim() ?? ''
  const page = parsePage(params.get('page'))
  const [input, setInput] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = input.trim()
      const updated = new URLSearchParams()
      if (trimmed) updated.set('q', trimmed)
      setParams(updated)
    }, 300)
    return () => clearTimeout(timer)
  }, [input])
  const [status, setStatus] = useState<LibraryStatus>('watching')
  const [addedIds, setAddedIds] = useState<number[]>([])

  const searchQuery = useQuery({
    queryKey: ['search', query, page],
    queryFn: () => searchAnime(query, page),
    enabled: query.length > 0,
  })

  const addMutation = useMutation({
    mutationFn: (anilistId: number) => addToLibrary(anilistId, status),
    onSuccess: async (entry) => {
      setAddedIds((current) =>
        current.includes(entry.anilist_id) ? current : [...current, entry.anilist_id],
      )
      await queryClient.invalidateQueries({ queryKey: ['library'] })
      await queryClient.invalidateQueries({ queryKey: ['library-entry', entry.anilist_id] })
      await queryClient.invalidateQueries({ queryKey: ['episodes', entry.anilist_id] })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = input.trim()
    const updated = new URLSearchParams()
    if (next) {
      updated.set('q', next)
    }
    setParams(updated)
  }

  function setPage(next: number) {
    const updated = new URLSearchParams(params)
    if (next <= 1) {
      updated.delete('page')
    } else {
      updated.set('page', String(next))
    }
    setParams(updated)
  }

  const addingId = addMutation.isPending ? addMutation.variables : undefined
  const failedId =
    addMutation.isError && addMutation.variables != null ? addMutation.variables : undefined
  const addError =
    addMutation.error instanceof ApiError
      ? addMutation.error.message
      : addMutation.error
        ? 'Could not add that anime'
        : null

  return (
    <section className={UI.page}>
      <PageHeader title="Search" description="Find shows on AniList and add them to your list." />
      <form onSubmit={onSubmit} className="ui-card flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="block flex-1 space-y-1.5">
          <span className={UI.fieldLabel}>Title</span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={INPUT_PLACEHOLDERS.animeTitle}
            className={UI.input}
          />
        </label>
        <label className="block space-y-1.5 sm:w-48">
          <span className={UI.fieldLabel}>Add as</span>
          <Select
            value={status}
            onChange={(value) => setStatus(value as LibraryStatus)}
            options={libraryStatusSelectOptions()}
          />
        </label>
        <button type="submit" className={cn(UI.btn, UI.btnPrimary)}>
          Search
        </button>
      </form>
      {query.length === 0 ? (
        <p className={UI.pageLead}>Search AniList by title, then add a show to your list.</p>
      ) : null}
      {searchQuery.isPending && query.length > 0 ? <LoadingIndicator label="Searching…" /> : null}
      {searchQuery.isError ? (
        <ErrorPanel
          message={
            searchQuery.error instanceof ApiError ? searchQuery.error.message : 'Search failed'
          }
          onRetry={() => {
            void searchQuery.refetch()
          }}
        />
      ) : null}
      {searchQuery.data && searchQuery.data.results.length === 0 ? (
        <EmptyState>No matches for “{query}”. Try another title or spelling.</EmptyState>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {searchQuery.data?.results.map((anime) => {
          const title = displayTitle(anime)
          const added = addedIds.includes(anime.anilist_id)
          const pending = addingId === anime.anilist_id
          return (
            <li key={anime.anilist_id} className={cn(UI.card, UI.cardInteractive)}>
              <Link
                to={`/anime/${anime.anilist_id}`}
                state={{ back: backFromSearch(params) }}
                className="flex gap-3"
              >
                {anime.cover_url ? (
                  <img
                    src={anime.cover_url}
                    alt=""
                    className="h-24 w-16 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="h-24 w-16 shrink-0 rounded-md bg-zinc-800" />
                )}
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{title}</h2>
                  {anime.title_english && anime.title_romaji !== title ? (
                    <p className="truncate text-xs text-zinc-500">{anime.title_romaji}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-400">
                    {metaLine(anime.format, anime.season_year, anime.airing_status)}
                  </p>
                  <p className="text-xs text-zinc-500">{episodeCountLabel(anime.total_episodes)}</p>
                </div>
              </Link>
              <div className="mt-3">
                {added ? (
                  <Link
                    to={`/anime/${anime.anilist_id}`}
                    state={{ back: backFromSearch(params) }}
                    className="inline-block text-sm text-indigo-400 hover:underline"
                  >
                    In your list
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => addMutation.mutate(anime.anilist_id)}
                    className={cn(UI.btn, UI.btnPrimary, 'w-full')}
                  >
                    {pending ? 'Adding…' : 'Add to list'}
                  </button>
                )}
                {failedId === anime.anilist_id && addError ? (
                  <p className="mt-2 text-sm text-red-400">{addError}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      {searchQuery.data ? (
        <Pager
          page={searchQuery.data.page}
          hasNext={searchQuery.data.has_next_page}
          onPage={setPage}
        />
      ) : null}
    </section>
  )
}
