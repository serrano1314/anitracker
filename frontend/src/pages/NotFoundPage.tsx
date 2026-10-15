import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-zinc-400">That URL does not match anything in the app.</p>
      <Link to="/" className="inline-block text-indigo-400 hover:underline">
        Go to My List
      </Link>
    </section>
  )
}
