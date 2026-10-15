const EXTENSION_ZIP_PATH = '/anime-tracker-extension.zip'

function extensionApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim().replace(/\/+$/, '')
  }
  return 'http://127.0.0.1:8000'
}

export function ExtensionDownloadSection() {
  const apiBase = extensionApiBase()

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div>
        <h2 className="text-xl font-semibold">Chrome extension</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Episode saving from other sites runs in Chrome on your computer. Download the extension
          here, unzip it, and load that folder in Chrome.
        </p>
      </div>
      <a
        href={EXTENSION_ZIP_PATH}
        download="anime-tracker-extension.zip"
        className="inline-block rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400"
      >
        Download extension
      </a>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-300">
        <li>Download the zip and unzip it. Keep the folder named anime-tracker-extension.</li>
        <li>
          In Chrome, open <span className="font-mono text-zinc-100">chrome://extensions</span>.
        </li>
        <li>Turn on Developer mode.</li>
        <li>Click Load unpacked and select the anime-tracker-extension folder.</li>
        <li>
          Open the extension popup. API is already{' '}
          <span className="font-mono text-zinc-100">{apiBase}</span>. Leave it as it is.
        </li>
        <li>
          Create a token in the section below, paste it into Extension token, and click Save token.
          Allow the site permission Chrome asks for.
        </li>
      </ol>
    </section>
  )
}
