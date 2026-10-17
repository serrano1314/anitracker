import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ChangeEvent } from 'react'
import { ApiError } from '../api/client'
import { downloadLibraryExport, importLibraryBackup } from '../api/library'
import { useDialog } from './dialogContext'
import { ErrorPanel } from './PageStatus'

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function LibraryBackupSection({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient()
  const dialog = useDialog()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const exportMutation = useMutation({
    mutationFn: downloadLibraryExport,
  })

  const importMutation = useMutation({
    mutationFn: importLibraryBackup,
    onSuccess: async (result) => {
      setImportError(null)
      await queryClient.invalidateQueries()
      await dialog.success({
        title: 'Import complete',
        message: `Merged ${result.library_entries_merged} list entries and ${result.episodes_added} new episode marks.`,
      })
    },
    onError: (error) => {
      setImportError(errorText(error, 'Import failed'))
    },
  })

  async function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    setImportError(null)
    let text: string
    try {
      text = await file.text()
    } catch {
      setImportError('Could not read that file')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      setImportError('File is not valid JSON')
      return
    }
    const document =
      parsed && typeof parsed === 'object' && 'document' in parsed
        ? (parsed as { document: unknown }).document
        : parsed
    const confirmed = await dialog.confirm({
      title: 'Import library',
      message:
        'Merge this backup into your account? Existing entries are updated; nothing is deleted. Episode marks are combined.',
      confirmLabel: 'Import',
    })
    if (!confirmed) {
      return
    }
    importMutation.mutate(document)
  }

  return (
    <section className="space-y-4">
      {!compact ? <div>
        <h2 className="text-xl font-semibold">Backup</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Export your list, episode progress, watch sites, and per-anime site links as JSON. Import
          merges into this account without deleting data that is not in the file.
        </p>
      </div> : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
          className="rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-60"
        >
          {exportMutation.isPending ? 'Preparing…' : 'Export JSON'}
        </button>
        <button
          type="button"
          disabled={importMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-zinc-700 px-4 py-2 hover:bg-zinc-800 disabled:opacity-60"
        >
          {importMutation.isPending ? 'Importing…' : 'Import JSON'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            void onImportFile(event)
          }}
        />
      </div>
      {exportMutation.error ? (
        <ErrorPanel message={errorText(exportMutation.error, 'Export failed')} />
      ) : null}
      {importError ? <ErrorPanel message={importError} /> : null}
    </section>
  )
}
