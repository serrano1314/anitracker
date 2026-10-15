import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchAnime } from '../api/anime'
import { ApiError } from '../api/client'
import { addToLibrary } from '../api/library'
import { Pager } from '../components/Pager'
import { displayTitle, metaLine } from '../lib/display'
import { episodeCountLabel } from '../lib/episodes'
import { STATUS_LABELS, type LibraryStatus } from '../types/library'

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
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Search</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label className="block flex-1 space-y-1 text-sm">
          <span className="text-zinc-300">Title</span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="One Piece"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm sm:w-48">
          <span className="text-zinc-300">Add as</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as LibraryStatus)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 sm:self-end"
        >
          Search
        </button>
      </form>
      {query.length === 0 ? (
        <p className="text-zinc-400">Search AniList by title, then add a show to your list.</p>
      ) : null}
      {searchQuery.isPending && query.length > 0 ? <p className="text-zinc-400">Searching…</p> : null}
      {searchQuery.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-red-400">
            {searchQuery.error instanceof ApiError
              ? searchQuery.error.message
              : 'Search failed'}
          </p>
          <button
            type="button"
            onClick={() => {
              void searchQuery.refetch()
            }}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
          >
            Try again
          </button>
        </div>
      ) : null}
      {searchQuery.data && searchQuery.data.results.length === 0 ? (
        <p className="text-zinc-400">No matches for “{query}”.</p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {searchQuery.data?.results.map((anime) => {
          const title = displayTitle(anime)
          const added = addedIds.includes(anime.anilist_id)
          const pending = addingId === anime.anilist_id
          return (
            <li key={anime.anilist_id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <Link to={`/anime/${anime.anilist_id}`} className="flex gap-3">
                {anime.cover_url ? (
                  <img
                    src={anime.cover_url}
                    alt=""
                    className="h-24 w-16 shrink-0 rounded-md object-cover"
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
                    className="inline-block text-sm text-indigo-400 hover:underline"
                  >
                    In your list
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => addMutation.mutate(anime.anilist_id)}
                    className="w-full rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium hover:bg-indigo-400 disabled:opacity-60"
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
