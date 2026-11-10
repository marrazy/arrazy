import { API_URL } from '../config.js'
import { timeAgo, useNow } from '../hooks/useNow.js'
import { usePolling } from '../hooks/usePolling.js'

// The backend caches this for 10 minutes and the model updates a few times a day.
const POLL_MS = 5 * 60_000

export function Aqi() {
  const { data, error } = usePolling(`${API_URL}/v1/aqi/jakarta`, POLL_MS)
  const now = useNow(30_000)

  const loading = !data && !error
  const available = Boolean(data?.available)
  const history = available ? data.history : []
  const values = history.map((point) => point.aqi).filter((aqi) => aqi != null)
  // Bars are scaled against at least 100, so a clean day doesn't look alarming
  const scale = Math.max(100, ...values)

  let foot = 'Last 24h'
  if (available && data.fetched_at) foot += ` · updated ${timeAgo(Date.parse(data.fetched_at), now)}`
  if (!loading && !available) foot = 'No data right now'

  return (
    <section className="card widget widget--aqi" aria-busy={loading}>
      <h2 className="card__title">Jakarta air quality</h2>

      <div className="aqi__reading">
        <span className="aqi__value">{available ? data.aqi : '–'}</span>
        <span className="pill">{loading ? 'Loading…' : available ? data.category : 'Unavailable'}</span>
      </div>

      <div
        className="aqi__bars"
        role="img"
        aria-label={
          values.length
            ? `US AQI over the last ${history.length} hours, from ${values[0]} to ${values[values.length - 1]}`
            : 'No air quality history available'
        }
      >
        {history.map((point, index) => (
          <span
            key={point.time}
            className={`aqi__bar${index === history.length - 1 ? ' is-now' : ''}${point.aqi == null ? ' is-missing' : ''}`}
            style={{ height: point.aqi == null ? '4%' : `${Math.max(4, (point.aqi / scale) * 100)}%` }}
            title={`${point.time.slice(11)} · ${point.aqi ?? 'no data'}`}
          />
        ))}
      </div>

      <p className="card__foot">
        {foot}
        <br />
        via Open-Meteo (CAMS)
      </p>
    </section>
  )
}
