import { useNow } from '../hooks/useNow.js'

const CITIES = [
  { name: 'Sydney', timeZone: 'Australia/Sydney' },
  { name: 'Jakarta', timeZone: 'Asia/Jakarta', zoneLabel: 'WIB' }, // no daylight saving
]

function formatTime(now, timeZone) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)
}

// "AEDT" in summer, "AEST" in winter
function zoneName(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone, timeZoneName: 'short' }).formatToParts(now)
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
}

export function LocalTime() {
  const now = useNow(15_000)
  return (
    <section className="card widget">
      <h2 className="card__title">Local time</h2>
      {CITIES.map((city, index) => (
        <div key={city.name}>
          {index > 0 && <div className="divider divider--spaced" />}
          <div className="clock">
            <time className="clock__time">{formatTime(now, city.timeZone)}</time>
            <span className="clock__place">
              {city.name} · {city.zoneLabel ?? zoneName(now, city.timeZone)}
            </span>
          </div>
        </div>
      ))}
    </section>
  )
}
