import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { createSite, deleteSite, fetchSites, updateSite } from '../api/sites'
import { useDialog } from '../components/dialogContext'
import { ExtensionTokensSection } from '../components/ExtensionTokensSection'
import type { SiteInput, WatchSite } from '../types/sites'

type SiteDraft = {
  name: string
  base_url: string
  episode_url_template: string
  search_url_template: string
}

const emptyDraft = (): SiteDraft => ({
  name: '',
  base_url: '',
  episode_url_template: '',
  search_url_template: '',
})

function draftFromSite(site: WatchSite): SiteDraft {
  return {
    name: site.name,
    base_url: site.base_url,
    episode_url_template: site.episode_url_template ?? '',
    search_url_template: site.search_url_template ?? '',
  }
}

function toInput(draft: SiteDraft): SiteInput {
  return {
    name: draft.name.trim(),
    base_url: draft.base_url.trim(),
    episode_url_template: draft.episode_url_template.trim() || null,
    search_url_template: draft.search_url_template.trim() || null,
  }
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const dialog = useDialog()
  const [draft, setDraft] = useState<SiteDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: fetchSites,
  })

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['sites'] })
    await queryClient.invalidateQueries({ queryKey: ['anime-sites'] })
    await queryClient.invalidateQueries({ queryKey: ['watch-links'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = toInput(draft)
      return editingId ? updateSite(editingId, body) : createSite(body)
    },
    onSuccess: async () => {
      setDraft(emptyDraft())
      setEditingId(null)
      await refresh()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSite,
    onSuccess: async (_data, siteId) => {
      if (editingId === siteId) {
        setDraft(emptyDraft())
        setEditingId(null)
      }
      await refresh()
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveMutation.mutate()
  }

  async function onDelete(site: WatchSite) {
    const confirmed = await dialog.confirm({
      title: 'Delete watch site',
      message: `Delete ${site.name}? It will also be removed from every anime that uses it.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    try {
      await deleteMutation.mutateAsync(site.id)
    } catch (error) {
      await dialog.error({
        title: 'Could not delete site',
        message: errorText(error, 'Could not delete this site.'),
      })
    }
  }

  const error = sitesQuery.error ?? saveMutation.error ?? deleteMutation.error

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Save the sites you watch on. Episode links can use {'{slug}'}, {'{title}'}, and{' '}
          {'{episode}'}. {'{slug}'} is the lowercase English title when there is one, otherwise
          romaji, with only letters and numbers kept and spaces as hyphens.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-medium">{editingId ? 'Edit watch site' : 'Add a watch site'}</h2>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Name</span>
          <input
            required
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Site URL</span>
          <input
            required
            type="url"
            value={draft.base_url}
            onChange={(event) => setDraft({ ...draft, base_url: event.target.value })}
            placeholder="https://example.com"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Episode URL template</span>
          <input
            value={draft.episode_url_template}
            onChange={(event) => setDraft({ ...draft, episode_url_template: event.target.value })}
            placeholder="https://example.com/watch/{slug}-episode-{episode}"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Search URL template</span>
          <input
            value={draft.search_url_template}
            onChange={(event) => setDraft({ ...draft, search_url_template: event.target.value })}
            placeholder="https://example.com/search?q={title}"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add site'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setDraft(emptyDraft())
              }}
              className="rounded-md border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {sitesQuery.isPending ? <p className="text-zinc-400">Loading sites…</p> : null}
      {sitesQuery.data?.length === 0 ? <p className="text-sm text-zinc-400">No watch sites yet.</p> : null}
      {sitesQuery.data?.length ? (
        <ul className="space-y-2">
          {sitesQuery.data.map((site) => (
            <li
              key={site.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{site.name}</p>
                <p className="truncate text-sm text-zinc-400">{site.base_url}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(site.id)
                    setDraft(draftFromSite(site))
                  }}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    void onDelete(site)
                  }}
                  className="rounded-md border border-red-500/60 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-red-400">{errorText(error, 'Could not update sites')}</p> : null}
      <ExtensionTokensSection />
    </section>
  )
}
