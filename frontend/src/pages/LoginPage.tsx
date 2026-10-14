import { useState, type FormEvent, useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'

interface AnimeSlide {
  id: number
  title: string
  cover: string
  english?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const { isReady, isAuthenticated, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [slides, setSlides] = useState<AnimeSlide[]>([])
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>(null)

  if (isReady && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  useEffect(() => {
    async function loadCarousel() {
      try {
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query {
              Page(page: 1, perPage: 6) {
                media(type: ANIME, sort: POPULARITY_DESC) {
                  id
                  title { romaji english }
                  coverImage { large extraLarge }
                }
              }
            }`,
          }),
        })
        const json = await res.json()
        const media = json?.data?.Page?.media || []
        const mapped: AnimeSlide[] = media
          .filter((m: unknown) => typeof m === 'object' && m !== null && (m as { coverImage?: { extraLarge?: string; large?: string } }).coverImage?.extraLarge || (m as { coverImage?: { large?: string } }).coverImage?.large)
          .map((m: unknown) => {
            const item = m as { id: number; title: { romaji?: string; english?: string }; coverImage: { extraLarge: string; large?: string } }
            return {
              id: item.id,
              title: item.title?.romaji || item.title?.english || 'Unknown',
              cover: item.coverImage.extraLarge || item.coverImage.large || '',
              english: item.title?.english || undefined,
            }
          })
        if (mapped.length) setSlides(mapped)
      } catch {
        // fail silently for carousel
      }
    }
    loadCarousel()
  }, [])

  useEffect(() => {
    if (slides.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [slides.length])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-neutral-950 text-neutral-50">
      {/* Left: Carousel */}
      <section className="relative hidden md:flex md:w-[60%] lg:w-[55%] flex-col items-stretch justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/60 via-neutral-950/30 to-neutral-950/60 z-20 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-[45%] bg-gradient-to-l from-neutral-950 via-neutral-950/70 to-transparent z-20 pointer-events-none" />
        <div className="relative h-full w-full">
          {slides.map((slide, idx) => (
            <a
              key={slide.id}
              href={`https://anilist.co/anime/${slide.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            >
              <img
                src={slide.cover}
                alt={slide.title}
                className="h-full w-full object-cover scale-105 hover:scale-100 transition-transform duration-[3000ms] ease-out"
              />
              {/* Title overlay */}
              <div className="absolute bottom-12 left-12 z-30 max-w-md">
                <h2 className="text-4xl font-extrabold leading-tight drop-shadow-2xl tracking-tight">
                  {slide.title}
                </h2>
                {slide.english && slide.english !== slide.title && (
                  <p className="mt-2 text-lg text-neutral-300 drop-shadow-lg">{slide.english}</p>
                )}
                <span className="inline-block mt-4 rounded-full bg-white/10 backdrop-blur-md border border-white/10 px-4 py-1.5 text-xs font-medium text-neutral-200">
                  View on AniList
                </span>
              </div>
            </a>
          ))}
        </div>
        {/* Carousel dots */}
        <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${idx === current ? 'w-8 bg-indigo-400' : 'w-3 bg-white/30 hover:bg-white/50'}`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Right: Login form */}
      <section className="relative flex w-full md:w-[40%] lg:w-[45%] items-center justify-center px-6 lg:px-12">
        {/* Moving objects behind login */}
        <div className="pointer-events-none absolute top-16 left-12 h-20 w-20 rounded-full bg-indigo-300/25 blur-2xl animate-[float_8s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute bottom-28 right-16 h-16 w-16 rounded-full bg-violet-300/25 blur-xl animate-[float_7s_ease-in-out_infinite_reverse]" />
        <div className="pointer-events-none absolute top-1/2 right-8 h-10 w-10 rounded-full bg-fuchsia-300/25 blur-lg animate-[float_9s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute top-20 right-20 h-72 w-72 rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-20 left-10 h-56 w-56 rounded-full bg-violet-600/10 blur-[100px]" />

        <form
          onSubmit={onSubmit}
          className="relative z-10 w-full max-w-md animate-[unlock-in_0.9s_ease-out_forwards] space-y-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 lg:p-10 shadow-2xl backdrop-blur-2xl bg-gradient-to-b from-white/[0.05] to-white/[0.01]"
        >
          <div className="space-y-1.5">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Sign in</h1>
            <p className="text-sm text-neutral-400">Continue to your anime tracker</p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="text-neutral-300 font-medium">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent transition shadow-inner"
                placeholder="you@example.com"
              />
            </label>

            <label className="block space-y-1.5 text-sm">
              <span className="text-neutral-300 font-medium">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent transition shadow-inner"
                placeholder="••••••••"
              />
            </label>
          </div>

          {error ? (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-5 py-3.5 font-bold text-white shadow-xl shadow-indigo-900/30 hover:shadow-indigo-900/50 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-neutral-400">
            No account?{' '}
            <Link to="/register" className="font-semibold text-indigo-300 hover:text-indigo-200 hover:underline transition">Register</Link>
          </p>
        </form>
      </section>
    </main>
  )
}
