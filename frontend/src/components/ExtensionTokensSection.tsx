import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { INPUT_PLACEHOLDERS } from '../lib/placeholders'
import { createExtensionToken, fetchExtensionTokens, revokeExtensionToken } from '../api/extension'
import type { ExtensionToken } from '../types/extension'
import { ErrorPanel, LoadingIndicator } from './PageStatus'
import { useDialog } from './dialogContext'

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function formatWhen(value: string | null): string {
  if (!value) {
    return 'Not used yet'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Not used yet'
  }
  return `Last used ${date.toLocaleString()}`
}

export function ExtensionTokensSection() {
  const queryClient = useQueryClient()
  const dialog = useDialog()
  const [name, setName] = useState('')
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [copyNote, setCopyNote] = useState<string | null>(null)

  const tokensQuery = useQuery({
    queryKey: ['extension-tokens'],
    queryFn: fetchExtensionTokens,
  })

  const createMutation = useMutation({
    mutationFn: () => createExtensionToken(name.trim()),
    onSuccess: async (created) => {
      setName('')
      setFreshToken(created.token)
      setCopyNote(null)
      await queryClient.invalidateQueries({ queryKey: ['extension-tokens'] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: revokeExtensionToken,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['extension-tokens'] })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFreshToken(null)
    createMutation.mutate()
  }

  async function onCopy() {
    if (!freshToken) {
      return
    }
    try {
      await navigator.clipboard.writeText(freshToken)
      setCopyNote('Copied')
    } catch {
      setCopyNote('Select the token and copy it')
    }
  }

  async function onRevoke(token: ExtensionToken) {
    const confirmed = await dialog.confirm({
      title: 'Revoke extension token',
      message: `Revoke ${token.name}? The extension will stop saving progress until you paste a new token.`,
      confirmLabel: 'Revoke',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    try {
      await revokeMutation.mutateAsync(token.id)
    } catch (error) {
      await dialog.error({
        title: 'Could not revoke token',
        message: errorText(error, 'Could not revoke this token.'),
      })
    }
  }

  const error = tokensQuery.error ?? createMutation.error ?? revokeMutation.error

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Extension tokens</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Create a token and paste it into the Chrome extension. The token is shown once. It is
          separate from your login session.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-end">
        <label className="block flex-1 space-y-1 text-sm">
          <span className="text-zinc-300">Token name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={INPUT_PLACEHOLDERS.extensionTokenName}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-60"
        >
          {createMutation.isPending ? 'Creating…' : 'Create token'}
        </button>
      </form>
      {freshToken ? (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-100">Copy this token now. It will not be shown again.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={freshToken}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => {
                void onCopy()
              }}
              className="rounded-md border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
            >
              Copy
            </button>
          </div>
          {copyNote ? <p className="text-sm text-zinc-300">{copyNote}</p> : null}
        </div>
      ) : null}
      {tokensQuery.isPending ? <LoadingIndicator label="Loading tokens…" /> : null}
      {tokensQuery.isError ? (
        <ErrorPanel
          message={errorText(tokensQuery.error, 'Could not load extension tokens')}
          onRetry={() => {
            void tokensQuery.refetch()
          }}
        />
      ) : null}
      {tokensQuery.data?.length === 0 ? <p className="text-sm text-zinc-400">No extension tokens yet.</p> : null}
      {tokensQuery.data?.length ? (
        <ul className="space-y-2">
          {tokensQuery.data.map((token) => (
            <li
              key={token.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{token.name}</p>
                <p className="text-sm text-zinc-400">{formatWhen(token.last_used_at)}</p>
              </div>
              <button
                type="button"
                disabled={revokeMutation.isPending}
                onClick={() => {
                  void onRevoke(token)
                }}
                className="rounded-md border border-red-500/60 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-red-400">{errorText(error, 'Could not update extension tokens')}</p> : null}
    </section>
  )
}
