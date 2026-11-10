import { API_URL } from '../config.js'
import { timeAgo, useNow } from '../hooks/useNow.js'
import { usePolling } from '../hooks/usePolling.js'

// The backend caches Spotify for 20 seconds, so asking every 30 seconds is plenty.
const POLL_MS = 30_000

export function NowPlaying() {
  const { data, error, fetchedAt } = usePolling(`${API_URL}/v1/spotify/now-playing`, POLL_MS)
  const now = useNow(1000)

  const loading = !data && !error
  const hasTrack = Boolean(data?.title)

  let footer = 'via Spotify'
  if (hasTrack && data.playing) {
    footer = `via Spotify · Fetched ${timeAgo(fetchedAt, now)}`
  } else if (hasTrack && data.played_at) {
    footer = `via Spotify · Last listened ${timeAgo(Date.parse(data.played_at), now)}`
  } else if (hasTrack) {
    footer = `via Spotify · Paused · Fetched ${timeAgo(fetchedAt, now)}`
  }

  return (
    <section className="card now-playing" aria-busy={loading}>
      <h2 className="card__title">Now playing</h2>

      {hasTrack || loading ? (
        <div className={`now-playing__track${hasTrack && !data.playing ? ' is-quiet' : ''}`}>
          {data?.album_art ? (
            <img className="now-playing__art" src={data.album_art} alt="" width="104" height="104" />
          ) : (
            <div className="now-playing__art now-playing__art--empty" aria-hidden="true" />
          )}
          <div className="now-playing__info">
            {hasTrack ? (
              <a className="now-playing__song" href={data.url ?? undefined} target="_blank" rel="noopener">
                {data.title}
              </a>
            ) : (
              <span className="now-playing__song is-loading">Loading…</span>
            )}
            {hasTrack && <span className="now-playing__artist">{data.artist}</span>}
          </div>
        </div>
      ) : (
        <div className="empty">
          <span className="empty__title">Nothing playing right now</span>
          <span className="empty__text">Check back later.</span>
        </div>
      )}

      <p className="card__foot">{footer}</p>
    </section>
  )
}
