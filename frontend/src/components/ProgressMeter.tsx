import { progressLabel, progressRatio } from '../lib/episodes'

type ProgressMeterProps = {
  watchedCount: number
  totalEpisodes: number | null
  lastEpisodeWatched?: number
}

export function ProgressMeter({
  watchedCount,
  totalEpisodes,
  lastEpisodeWatched,
}: ProgressMeterProps) {
  const label = progressLabel(watchedCount, totalEpisodes)
  const ratio = progressRatio(watchedCount, totalEpisodes)
  const showLast =
    lastEpisodeWatched != null && lastEpisodeWatched > 0 && lastEpisodeWatched !== watchedCount

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-zinc-400">Progress</span>
        <span className="font-medium tabular-nums">{label}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuenow={watchedCount}
        aria-valuemax={totalEpisodes != null && totalEpisodes > 0 ? totalEpisodes : undefined}
        aria-label={`Progress ${label}`}
      >
        {ratio != null ? (
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${ratio * 100}%` }} />
        ) : null}
      </div>
      {showLast ? (
        <p className="text-xs text-zinc-500">Last episode {lastEpisodeWatched}</p>
      ) : null}
    </div>
  )
}
