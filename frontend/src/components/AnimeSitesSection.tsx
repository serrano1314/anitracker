import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { INPUT_PLACEHOLDERS } from '../lib/placeholders'
import { UI, cn } from '../lib/ui'
import { Select } from './Select'
import { addAnimeSite, fetchAnimeSites, fetchSites, removeAnimeSite } from '../api/sites'
import { useDialog } from './dialogContext'

type AnimeSitesSectionProps = {
  anilistId: number
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function AnimeSitesSection({ anilistId }: AnimeSitesSectionProps) {
  const queryClient = useQueryClient()
  const dialog = useDialog()
  const [siteId, setSiteId] = useState('')
  const [animeUrl, setAnimeUrl] = useState('')

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: fetchSites,
  })
  const animeSitesQuery = useQuery({
    queryKey: ['anime-sites', anilistId],
    queryFn: () => fetchAnimeSites(anilistId),
  })

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['anime-sites', anilistId] })
    await queryClient.invalidateQueries({ queryKey: ['watch-links', anilistId] })
  }

  const addMutation = useMutation({
    mutationFn: () => addAnimeSite(anilistId, siteId, animeUrl),
    onSuccess: async () => {
      setSiteId('')
      setAnimeUrl('')
      await refresh()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeAnimeSite(anilistId, id),
    onSuccess: refresh,
  })

  const linked = new Set((animeSitesQuery.data ?? []).map((site) => site.site_id))
  const available = (sitesQuery.data ?? []).filter((site) => !linked.has(site.id))
  const error = sitesQuery.error ?? animeSitesQuery.error ?? addMutation.error ?? removeMutation.error

  async function onRemove(id: string, name: string) {
    const confirmed = await dialog.confirm({
      title: 'Remove site',
      message: `Stop using ${name} for this anime?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    try {
      await removeMutation.mutateAsync(id)
    } catch (removeError) {
      await dialog.error({
        title: 'Could not remove site',
        message: errorText(removeError, 'Could not remove this site.'),
      })
    }
  }

  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!siteId) {
      return
    }
    addMutation.mutate()
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div>
        <h2 className="font-semibold">My sites for this anime</h2>
        <p className="mt-1 text-sm text-zinc-400">
          A page URL is used as-is. Otherwise the episode template is filled in, then the search
          template.
        </p>
      </div>
      {animeSitesQuery.data?.length ? (
        <ul className="space-y-2">
          {animeSitesQuery.data.map((site) => (
            <li
              key={site.site_id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-800 px-3 py-2 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{site.name}</p>
                <p className="truncate text-sm text-zinc-400">{site.anime_url ?? site.base_url}</p>
              </div>
              <button
                type="button"
                disabled={removeMutation.isPending}
                onClick={() => {
                  void onRemove(site.site_id, site.name)
                }}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400">No sites saved for this anime yet.</p>
      )}
      {sitesQuery.data && sitesQuery.data.length === 0 ? (
        <p className="text-sm text-zinc-300">
          Add a watch site in{' '}
          <Link to="/settings" className="text-indigo-300 hover:underline">
            Settings
          </Link>
          .
        </p>
      ) : null}
      {available.length > 0 ? (
        <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={UI.fieldLabel}>Site</span>
            <Select
              value={siteId}
              onChange={setSiteId}
              placeholder="Choose a site"
              options={available.map((site) => ({ value: site.id, label: site.name }))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={UI.fieldLabel}>Page URL for this anime</span>
            <input
              value={animeUrl}
              onChange={(event) => setAnimeUrl(event.target.value)}
              placeholder={INPUT_PLACEHOLDERS.animePageUrl}
              className={UI.input}
            />
          </label>
          <button
            type="submit"
            disabled={!siteId || addMutation.isPending}
            className={cn(UI.btn, UI.btnPrimary, 'sm:col-span-2 sm:justify-self-start')}
          >
            {addMutation.isPending ? 'Saving…' : 'Add site'}
          </button>
        </form>
      ) : null}
      {error ? <p className="text-sm text-red-400">{errorText(error, 'Could not update sites')}</p> : null}
    </section>
  )
}
